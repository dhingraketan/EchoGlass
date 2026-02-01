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

    const { error: deleteError } = await supabase
      .from('todo')
      .delete()
      .eq('id', todos[0].id)

    if (deleteError) {
      throw new Error(`Failed to remove todo: ${deleteError.message}`)
    }

    return { ok: true, deleted: true }
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
