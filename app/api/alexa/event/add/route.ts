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
    const supabase = createServerClient()
    await supabase.from('command_logs').insert({
      source: 'alexa',
      command_type: 'event/add',
      payload: {},
      status: 'error',
      message: 'Invalid secret',
      household_id: '00000000-0000-0000-0000-000000000000'
    })

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    // Support multiple formats: task/title, date, time
    // Also support ReminderIntent format with extracted JSON
    const task = body.task || body.title || body.item
    let date = body.date || null
    let time = body.time || null

    // If startAt is provided (old format), parse it into date and time
    if (body.startAt && !date) {
      const startDate = new Date(body.startAt)
      date = startDate.toISOString().split('T')[0] // YYYY-MM-DD
      const timeStr = startDate.toTimeString().split(' ')[0] // HH:MM:SS
      time = timeStr.substring(0, 5) // HH:MM
    }

    // Validate input
    if (!task || typeof task !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input: task/title/item is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Insert calendar event into the new calendar table schema
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
      // Try to log to command_logs if table exists
      try {
        await supabase.from('command_logs').insert({
          source: 'alexa',
          command_type: 'event/add',
          payload: body,
          status: 'error',
          message: error.message,
          household_id: process.env.NEXT_PUBLIC_HOUSEHOLD_ID || '00000000-0000-0000-0000-000000000000'
        })
      } catch (logError) {
        // Ignore logging errors
      }

      return NextResponse.json(
        { error: 'Failed to create calendar event', details: error.message },
        { status: 500 }
      )
    }

    // Log success (if command_logs table exists)
    try {
      await supabase.from('command_logs').insert({
        source: 'alexa',
        command_type: 'event/add',
        payload: body,
        status: 'ok',
        message: 'Calendar event created successfully',
        household_id: process.env.NEXT_PUBLIC_HOUSEHOLD_ID || '00000000-0000-0000-0000-000000000000'
      })
    } catch (logError) {
      // Ignore logging errors
    }

    return NextResponse.json({
      ok: true,
      eventId: calendarEvent.id
    })
  } catch (error: any) {
    const supabase = createServerClient()
    await supabase.from('command_logs').insert({
      source: 'alexa',
      command_type: 'event/add',
      payload: {},
      status: 'error',
      message: error.message || 'Unknown error',
      household_id: '00000000-0000-0000-0000-000000000000'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
