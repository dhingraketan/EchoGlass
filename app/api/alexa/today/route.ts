import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json(
        { error: 'householdId query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    const now = new Date()
    const startOfToday = new Date(now.setHours(0, 0, 0, 0))
    const endOfToday = new Date(now.setHours(23, 59, 59, 999))

    // Get open todos count
    const { count: openTodosCount } = await supabase
      .from('todos')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('is_done', false)

    // Get next event
    const { data: nextEvent } = await supabase
      .from('events')
      .select('*')
      .eq('household_id', householdId)
      .gte('start_at', startOfToday.toISOString())
      .order('start_at', { ascending: true })
      .limit(1)
      .single()

    return NextResponse.json({
      ok: true,
      openTodosCount: openTodosCount || 0,
      nextEvent: nextEvent || null
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
