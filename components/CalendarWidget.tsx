'use client'

import { Event } from '@/lib/types'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CalendarWidget({ householdId }: { householdId: string }) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    const fetchEvents = async () => {
      const now = new Date()
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('household_id', householdId)
        .gte('start_at', now.toISOString())
        .order('start_at', { ascending: true })
        .limit(4)

      // If table exists and has data, use it
      // Check for 404 or table not found errors
      if (error) {
        // Table doesn't exist (404) or other error - use mock data
        if (error.code === 'PGRST116' || error.message?.includes('404') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('events table not available, using mock data')
        } else {
          console.warn('Error fetching events:', error)
        }
      } else if (data && data.length > 0) {
        setEvents(data)
        setLoading(false)
        return
      }

      // Mock data for testing UI - use when table doesn't exist or no data
      const currentTime = new Date()
      const today = new Date(currentTime)
      today.setHours(currentTime.getHours() + 2, 0, 0, 0) // 2 hours from now
      
      const tomorrow = new Date(currentTime)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(10, 0, 0, 0) // Tomorrow 10 AM
      
      const dayAfterTomorrow = new Date(currentTime)
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
      dayAfterTomorrow.setHours(14, 0, 0, 0) // 2 days from now, 2 PM
      
      const feb2 = new Date(currentTime)
      feb2.setMonth(1, 2) // February 2
      feb2.setHours(14, 0, 0, 0)
      if (feb2.getTime() < currentTime.getTime()) {
        feb2.setFullYear(feb2.getFullYear() + 1) // If Feb 2 has passed, use next year
      }
      
      const feb4 = new Date(currentTime)
      feb4.setMonth(1, 4) // February 4
      feb4.setHours(10, 0, 0, 0)
      if (feb4.getTime() < currentTime.getTime()) {
        feb4.setFullYear(feb4.getFullYear() + 1) // If Feb 4 has passed, use next year
      }
      
      const mockEvents: Event[] = [
        {
          id: 'mock-1',
          title: 'Prod Meeting',
          start_at: today.toISOString(),
          end_at: new Date(today.getTime() + 60 * 60 * 1000).toISOString(), // +1 hour
          location: 'Conference Room A',
          notes: null,
          source: 'manual',
          household_id: householdId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'mock-2',
          title: 'Team Standup',
          start_at: tomorrow.toISOString(),
          end_at: new Date(tomorrow.getTime() + 30 * 60 * 1000).toISOString(), // +30 min
          location: null,
          notes: null,
          source: 'manual',
          household_id: householdId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'mock-3',
          title: 'Client Presentation',
          start_at: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(), // Tomorrow 12 PM
          end_at: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000).toISOString(), // +1 hour
          location: 'Main Office',
          notes: null,
          source: 'manual',
          household_id: householdId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'mock-4',
          title: 'Design Review',
          start_at: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000).toISOString(), // Tomorrow 2 PM
          end_at: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000).toISOString(), // +1 hour
          location: 'Design Studio',
          notes: null,
          source: 'manual',
          household_id: householdId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'mock-5',
          title: 'Code Review',
          start_at: dayAfterTomorrow.toISOString(),
          end_at: new Date(dayAfterTomorrow.getTime() + 60 * 60 * 1000).toISOString(), // +1 hour
          location: null,
          notes: null,
          source: 'manual',
          household_id: householdId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'mock-6',
          title: 'Budget Meeting',
          start_at: feb2.toISOString(),
          end_at: new Date(feb2.getTime() + 90 * 60 * 1000).toISOString(), // +1.5 hours
          location: 'Finance Office',
          notes: null,
          source: 'manual',
          household_id: householdId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'mock-7',
          title: 'Sprint Planning',
          start_at: feb4.toISOString(),
          end_at: new Date(feb4.getTime() + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
          location: 'Conference Room B',
          notes: null,
          source: 'manual',
          household_id: householdId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()) // Sort by start_at ascending
      
      setEvents(mockEvents)
      setLoading(false)
    }

    fetchEvents()

    // Subscribe to real-time changes (only if table exists)
    try {
      const channel = supabase
        .channel('events-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'events',
            filter: `household_id=eq.${householdId}`
          },
          () => {
            fetchEvents()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch (err) {
      // Table doesn't exist - no subscription
      return () => {}
    }
  }, [householdId])

  const formatEventTime = (startAt: string, endAt?: string) => {
    const startDate = new Date(startAt)
    const endDate = endAt ? new Date(endAt) : null
    
    const startTime = startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })
    
    const endTime = endDate ? endDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    }) : null
    
    return endTime ? `${startTime} - ${endTime}` : startTime
  }

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const groupEventsByDate = (events: Event[]) => {
    const grouped = new Map<string, Event[]>()
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
                        <span>{formatEventTime(event.start_at, event.end_at || undefined)}</span>
                      </div>
                      {event.location && (
                        <div className="text-white/60 text-xs mt-0.5">{event.location}</div>
                      )}
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
