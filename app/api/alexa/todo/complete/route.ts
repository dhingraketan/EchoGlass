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
    // Support both id and text/body/item for finding the todo
    const todoId = body.id || body.todoId
    const text = body.text || body.body || body.item
    const completed = body.completed !== undefined ? body.completed : true // Default to true (mark as done)

    // Validate input - need either id or text to find the todo
    if (!todoId && !text) {
      return NextResponse.json(
        { error: 'Invalid input: id or text/body/item is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    let error
    let updatedTodo = null

    if (todoId) {
      // Update by ID
      const { data, error: updateError } = await supabase
        .from('todo')
        .update({ completed })
        .eq('id', todoId)
        .select()
        .single()

      error = updateError
      updatedTodo = data
    } else {
      // Find by matching text (update first match)
      const { data: todos, error: findError } = await supabase
        .from('todo')
        .select('id')
        .ilike('body', `%${text}%`)
        .limit(1)

      if (findError) {
        error = findError
      } else if (todos && todos.length > 0) {
        const { data, error: updateError } = await supabase
          .from('todo')
          .update({ completed })
          .eq('id', todos[0].id)
          .select()
          .single()

        error = updateError
        updatedTodo = data
      } else {
        return NextResponse.json(
          { error: 'Todo not found' },
          { status: 404 }
        )
      }
    }

    if (error) {
      // Try to log to command_logs if table exists
      try {
        await supabase.from('command_logs').insert({
          source: 'alexa',
          command_type: 'todo/complete',
          payload: body,
          status: 'error',
          message: error.message,
          household_id: process.env.NEXT_PUBLIC_HOUSEHOLD_ID || '00000000-0000-0000-0000-000000000000'
        })
      } catch (logError) {
        // Ignore logging errors
      }

      return NextResponse.json(
        { error: 'Failed to update todo', details: error.message },
        { status: 500 }
      )
    }

    // Log success (if command_logs table exists)
    try {
      await supabase.from('command_logs').insert({
        source: 'alexa',
        command_type: 'todo/complete',
        payload: body,
        status: 'ok',
        message: `Todo marked as ${completed ? 'completed' : 'incomplete'}`,
        household_id: process.env.NEXT_PUBLIC_HOUSEHOLD_ID || '00000000-0000-0000-0000-000000000000'
      })
    } catch (logError) {
      // Ignore logging errors
    }

    return NextResponse.json({
      ok: true,
      todoId: updatedTodo?.id,
      completed: updatedTodo?.completed
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
