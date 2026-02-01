import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || request.ip || 'unknown'
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // Validate secret
  const secret = request.headers.get('x-mirror-secret')
  const expectedSecret = process.env.ALEXA_SHARED_SECRET

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    
    // Support Lambda function format: { action: "add", data: {...} }
    // Also support direct API calls: { text: "...", ... }
    const action = body.action
    const data = body.data || body

    let result

    switch (action) {
      case 'add':
      case 'todo/add':
        result = await handleAddTodo(data)
        break
      
      case 'remove':
      case 'todo/remove':
        result = await handleRemoveTodo(data)
        break
      
      case 'complete':
      case 'todo/complete':
        result = await handleCompleteTodo(data)
        break
      
      case 'reminder':
      case 'event/add':
        result = await handleAddCalendarEvent(data)
        break
      
      case 'youtube':
      case 'play/youtube':
        console.log('YouTube action detected, calling handleYouTubeCommand')
        result = await handleYouTubeCommand(data)
        console.log('YouTube command result:', result)
        break
      
      case 'photo_tryout':
      case 'tryout/photo':
        console.log('Photo tryout action detected, calling handlePhotoTryoutCommand')
        result = await handlePhotoTryoutCommand(data)
        console.log('Photo tryout command result:', result)
        break
      
      default:
        // If no action specified, try to infer from the data
        if (data.text || data.body || data.item) {
          if (data.completed !== undefined) {
            result = await handleCompleteTodo(data)
          } else {
            result = await handleAddTodo(data)
          }
        } else if (data.task || data.title) {
          result = await handleAddCalendarEvent(data)
        } else {
          return NextResponse.json(
            { error: 'Invalid action or missing required fields' },
            { status: 400 }
          )
        }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Handler functions
async function handleAddTodo(data: any) {
  const text = data.text || data.body || data.item

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text/body/item is required')
  }

  const supabase = createServerClient()
  const { data: todo, error } = await supabase
    .from('todo')
    .insert({
      body: text,
      completed: false
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create todo: ${error.message}`)
  }

  return {
    ok: true,
    todoId: todo.id
  }
}

async function handleRemoveTodo(data: any) {
  const todoId = data.id || data.todoId
  const text = data.text || data.body || data.item

  console.log('Remove todo request:', { todoId, text, data })

  if (!todoId && !text) {
    throw new Error('Invalid input: id or text/body/item is required')
  }

  const supabase = createServerClient()

  if (todoId) {
    const { error } = await supabase
      .from('todo')
      .delete()
      .eq('id', todoId)

    if (error) {
      throw new Error(`Failed to remove todo: ${error.message}`)
    }

    return { ok: true, deleted: true }
  } else {
    // Normalize the search text
    const searchText = String(text).trim().toLowerCase()
    console.log('Searching for todo with text:', searchText)
    
    // First try exact match (case-insensitive)
    let { data: todos, error: findError } = await supabase
      .from('todo')
      .select('id, body')
      .ilike('body', searchText)
      .limit(10)
    
    console.log('Exact match results:', { todos, findError })

    // If no exact match, try partial match
    if (!findError && (!todos || todos.length === 0)) {
      const { data: partialTodos, error: partialError } = await supabase
        .from('todo')
        .select('id, body')
        .ilike('body', `%${searchText}%`)
        .limit(10)

      if (!partialError) {
        todos = partialTodos
        findError = null
      }
    }

    if (findError) {
      throw new Error(`Failed to find todo: ${findError.message}`)
    }

    if (!todos || todos.length === 0) {
      // Try to find the best match by checking if search text is contained in any todo
      const { data: allTodos, error: allError } = await supabase
        .from('todo')
        .select('id, body')
        .limit(50)

      if (!allError && allTodos) {
        // Find todos where the search text matches any part
        const matches = allTodos.filter(todo => 
          todo.body && todo.body.toLowerCase().includes(searchText)
        )

        if (matches.length > 0) {
          // Delete the first match
          const { error: deleteError } = await supabase
            .from('todo')
            .delete()
            .eq('id', matches[0].id)

          if (deleteError) {
            throw new Error(`Failed to remove todo: ${deleteError.message}`)
          }

          return { ok: true, deleted: true, matched: matches[0].body }
        }
      }

      throw new Error(`Todo not found: "${text}"`)
    }

    // Delete the first match
    const { error: deleteError } = await supabase
      .from('todo')
      .delete()
      .eq('id', todos[0].id)

    if (deleteError) {
      throw new Error(`Failed to remove todo: ${deleteError.message}`)
    }

    return { ok: true, deleted: true, matched: todos[0].body }
  }
}

async function handleCompleteTodo(data: any) {
  const todoId = data.id || data.todoId
  const text = data.text || data.body || data.item
  const completed = data.completed !== undefined ? data.completed : true

  if (!todoId && !text) {
    throw new Error('Invalid input: id or text/body/item is required')
  }

  const supabase = createServerClient()

  if (todoId) {
    const { data: updatedTodo, error } = await supabase
      .from('todo')
      .update({ completed })
      .eq('id', todoId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update todo: ${error.message}`)
    }

    return {
      ok: true,
      todoId: updatedTodo.id,
      completed: updatedTodo.completed
    }
  } else {
    // Find by matching text
    const { data: todos, error: findError } = await supabase
      .from('todo')
      .select('id')
      .ilike('body', `%${text}%`)
      .limit(1)

    if (findError) {
      throw new Error(`Failed to find todo: ${findError.message}`)
    }

    if (!todos || todos.length === 0) {
      throw new Error('Todo not found')
    }

    const { data: updatedTodo, error: updateError } = await supabase
      .from('todo')
      .update({ completed })
      .eq('id', todos[0].id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update todo: ${updateError.message}`)
    }

    return {
      ok: true,
      todoId: updatedTodo.id,
      completed: updatedTodo.completed
    }
  }
}

async function handleAddCalendarEvent(data: any) {
  const task = data.task || data.title || data.item
  let date = data.date || null
  let time = data.time || null

  // If startAt is provided (old format), parse it into date and time
  if (data.startAt && !date) {
    const startDate = new Date(data.startAt)
    date = startDate.toISOString().split('T')[0] // YYYY-MM-DD
    const timeStr = startDate.toTimeString().split(' ')[0] // HH:MM:SS
    time = timeStr.substring(0, 5) // HH:MM
  }

  if (!task || typeof task !== 'string') {
    throw new Error('Invalid input: task/title/item is required')
  }

  const supabase = createServerClient()
  const { data: calendarEvent, error } = await supabase
    .from('calendar')
    .insert({
      task: task,
      date: date || null,
      time: time || null
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create calendar event: ${error.message}`)
  }

  return {
    ok: true,
    eventId: calendarEvent.id
  }
}

async function handleYouTubeCommand(data: any) {
  console.log('handleYouTubeCommand called with data:', data)
  const supabase = createServerClient()
  
  // Create a new YouTube command record
  console.log('Inserting YouTube command into database...')
  const { data: command, error } = await supabase
    .from('youtube_commands')
    .insert({
      status: 'pending',
      youtube_url: null
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating YouTube command:', error)
    // If table doesn't exist, create it (this is a fallback - you should create the table in Supabase)
    if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('youtube_commands table does not exist. Please create it in Supabase.')
    }
    throw new Error(`Failed to create YouTube command: ${error.message}`)
  }

  console.log('YouTube command created successfully:', command)
  return {
    ok: true,
    commandId: command.id,
    message: 'YouTube command received. Waiting for URL submission.'
  }
}

async function handlePhotoTryoutCommand(data: any) {
  console.log('handlePhotoTryoutCommand called with data:', data)
  const supabase = createServerClient()
  
  // Create a new photo tryout command record
  console.log('Inserting photo tryout command into database...')
  const { data: command, error } = await supabase
    .from('photo_tryout_commands')
    .insert({
      status: 'pending',
      tryout_type: 'photo'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating photo tryout command:', error)
    if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('photo_tryout_commands table does not exist. Please create it in Supabase.')
    }
    throw new Error(`Failed to create photo tryout command: ${error.message}`)
  }

  console.log('Photo tryout command created successfully:', command)
  return {
    ok: true,
    commandId: command.id,
    message: 'Photo tryout command received. Waiting for clothing submission.'
  }
}
