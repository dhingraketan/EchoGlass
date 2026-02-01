'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CalendarItem {
  id: number
  created_at: string
  task: string
  date: string | null
  time: string | null
}

interface DisplayEvent {
  id: string
  title: string
  start_at: string
  end_at: string | null
}

export default function CalendarWidget({ householdId }: { householdId: string }) {
  const [events, setEvents] = useState<DisplayEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    const fetchEvents = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD format

      console.log('Fetching calendar events for date >=', todayStr)

      const { data, error } = await supabase
        .from('calendar')
        .select('*')
        .gte('date', todayStr) // Only future dates or today
        .order('date', { ascending: true })
        .order('time', { ascending: true, nullsFirst: false })
        .limit(10) // Get more to filter properly

      if (error) {
        console.error('Error fetching calendar events:', error)
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        // Check if table doesn't exist
        if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('404') || error.message?.includes('relation') || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
          console.error('calendar table not found - make sure the table exists in Supabase')
        }
        // Check if RLS is blocking access
        if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('RLS')) {
          console.error('RLS (Row Level Security) is blocking access. You need to either:')
          console.error('1. Disable RLS on the calendar table: ALTER TABLE calendar DISABLE ROW LEVEL SECURITY;')
          console.error('2. Create a policy: ALTER TABLE calendar ENABLE ROW LEVEL SECURITY;')
          console.error('   CREATE POLICY "Allow public read" ON calendar FOR SELECT USING (true);')
        }
        setEvents([])
        setLoading(false)
        return
      }

      console.log('Calendar query result:', { dataCount: data?.length || 0, data: data })

      if (data && data.length > 0) {
        // Convert calendar items to display events
        const displayEvents: DisplayEvent[] = data
          .map((item: CalendarItem) => {
            // Combine date and time into start_at ISO string
            let startAt = ''
            if (item.date) {
              if (item.time) {
                // Combine date and time: "2024-01-15" + "14:30:00" = "2024-01-15T14:30:00"
                startAt = `${item.date}T${item.time}`
              } else {
                // If no time, use start of day
                startAt = `${item.date}T00:00:00`
              }
            } else {
              // If no date, skip this item
              return null
            }

            // Create a Date object to check if it's in the future
            const eventDate = new Date(startAt)
            const now = new Date()
            
            // Only include if it's today or in the future
            if (eventDate >= now) {
              return {
                id: item.id.toString(),
                title: item.task,
                start_at: eventDate.toISOString(),
                end_at: null // No end_at in calendar schema
              }
            }
            return null
          })
          .filter((e: DisplayEvent | null): e is DisplayEvent => e !== null)
          .slice(0, 4) // Limit to 4 events

        setEvents(displayEvents)
        console.log('Fetched and processed calendar events:', displayEvents.length, displayEvents)
      } else {
        console.log('No calendar events found in database')
        setEvents([])
      }
      setLoading(false)
    }

    fetchEvents()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('calendar-changes', {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar'
        },
        (payload: any) => {
          console.log('Calendar real-time event received:', payload)
          fetchEvents()
        }
      )
      .subscribe((status: string) => {
        console.log('Calendar subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to calendar changes')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Calendar subscription error - check if Realtime is enabled for calendar table')
        }
      })

    return () => {
      console.log('Cleaning up calendar subscription')
      supabase.removeChannel(channel)
    }
  }, [])

  const formatEventTime = (startAt: string, endAt?: string | null) => {
    const startDate = new Date(startAt)
    
    const startTime = startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })
    
    // Since calendar table doesn't have end_at, just show start time
    return startTime
  }

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const groupEventsByDate = (events: DisplayEvent[]) => {
    const grouped = new Map<string, DisplayEvent[]>()
    events.forEach(event => {
      const date = new Date(event.start_at)
      const dateKey = date.toDateString()
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(event)
    })
    return Array.from(grouped.entries()).sort((a, b) => 
      new Date(a[0]).getTime() - new Date(b[0]).getTime()
    )
  }

  if (loading) {
    return (
      <div className="text-white">
        <div className="text-base font-bold mb-2">Upcoming</div>
        <div className="text-sm font-light text-white/60">Loading...</div>
      </div>
    )
  }

  const groupedEvents = groupEventsByDate(events)

  return (
    <div className="text-white">
      <div className="text-base font-bold mb-3">UPCOMING</div>
      <div className="border-t border-white/30 mb-4"></div>
      {events.length === 0 ? (
        <div className="text-sm font-light text-white/60">No upcoming events.</div>
      ) : (
        <div className="relative">
          {/* Single continuous vertical line with fade */}
          <div className="absolute left-[88px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-white via-white/60 to-white/30"></div>
          
          <div className="space-y-4">
            {groupedEvents.map(([dateKey, dayEvents], index) => {
              const opacity = Math.max(0.3, 1 - (index * 0.2)) // Fade from 100% down, minimum 30%
              return (
              <div key={dateKey} className="flex gap-4 relative" style={{ opacity: opacity }}>
                {/* Left: Day and Date */}
                <div className="flex-shrink-0 w-20 relative">
                  <div className="text-sm font-light">{formatDateHeader(dayEvents[0].start_at)}</div>
                  {/* Dot positioned on the line, top-aligned with date */}
                  <div className="absolute left-[89px] top-0 -translate-x-1/2 w-2 h-2 bg-white rounded-full"></div>
                </div>
                
                {/* Right: Events list */}
                <div className="flex-1 space-y-2 ml-4">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="text-sm font-light">
                      <div className="text-white whitespace-nowrap flex items-center gap-2">
                        <span className="inline-block w-32 text-left">{event.title}</span>
                        <span className="font-bold">::</span>
                        <span>{formatEventTime(event.start_at, event.end_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
