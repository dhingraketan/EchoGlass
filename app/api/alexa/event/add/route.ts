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
    const { householdId, title, startAt, endAt, location, notes } = body

    // Validate input
    if (!householdId || !title || !startAt) {
      return NextResponse.json(
        { error: 'Invalid input: householdId, title, and startAt are required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Insert event
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        household_id: householdId,
        title,
        start_at: startAt,
        end_at: endAt || null,
        location: location || null,
        notes: notes || null,
        source: 'alexa'
      })
      .select()
      .single()

    if (error) {
      await supabase.from('command_logs').insert({
        source: 'alexa',
        command_type: 'event/add',
        payload: body,
        status: 'error',
        message: error.message,
        household_id: householdId
      })

      return NextResponse.json(
        { error: 'Failed to create event', details: error.message },
        { status: 500 }
      )
    }

    // Log success
    await supabase.from('command_logs').insert({
      source: 'alexa',
      command_type: 'event/add',
      payload: body,
      status: 'ok',
      message: 'Event created successfully',
      household_id: householdId
    })

    return NextResponse.json({
      ok: true,
      eventId: event.id
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
