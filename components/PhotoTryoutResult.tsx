'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PhotoTryoutCommand {
  id: string
  status: 'pending' | 'waiting_photo' | 'processing' | 'completed' | 'failed'
  result_image_url: string | null
  error_message: string | null
}

const HEADING_OPTIONS = [
  "What do you think?",
  "Looks cool!",
  "How's this?",
  "Pretty nice, right?",
  "What's your take?",
  "Looking good!",
  "Check this out!",
  "Not bad, eh?"
]

export default function PhotoTryoutResult() {
  const [showResult, setShowResult] = useState(false)
  const [currentCommand, setCurrentCommand] = useState<PhotoTryoutCommand | null>(null)
  const [countdown, setCountdown] = useState(20)
  const [heading, setHeading] = useState("What do you think?")
  const supabaseRef = useRef(createClient())
  const showingResultRef = useRef(false)
  const componentMountTimeRef = useRef<Date>(new Date())
  
  // Load shown command IDs from localStorage on mount
  const loadShownCommandIds = (): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('photoTryoutShownCommandIds')
      if (stored) {
        const ids = JSON.parse(stored) as string[]
        // Only keep IDs from the last 24 hours to prevent localStorage from growing too large
        return new Set(ids)
      }
    } catch (err) {
      console.error('PhotoTryoutResult: Error loading shown command IDs:', err)
    }
    return new Set()
  }
  
  const saveShownCommandId = (id: string) => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('photoTryoutShownCommandIds')
      const ids = stored ? JSON.parse(stored) as string[] : []
      if (!ids.includes(id)) {
        ids.push(id)
        // Keep only last 100 IDs to prevent localStorage from growing too large
        const trimmedIds = ids.slice(-100)
        localStorage.setItem('photoTryoutShownCommandIds', JSON.stringify(trimmedIds))
      }
    } catch (err) {
      console.error('PhotoTryoutResult: Error saving shown command ID:', err)
    }
  }
  
  const shownCommandIdsRef = useRef<Set<string>>(loadShownCommandIds())

  // Helper function to check if we should show a command
  const shouldShowCommand = (command: PhotoTryoutCommand): boolean => {
    // Don't show if we've already shown this command
    if (shownCommandIdsRef.current.has(command.id)) {
      return false
    }
    
    // Only show if it has a result image
    if (!command.result_image_url) {
      return false
    }
    
    return true
  }

  // Helper function to show a command
  const showCommand = (command: PhotoTryoutCommand) => {
    if (shouldShowCommand(command)) {
      console.log('PhotoTryoutResult: Showing result for command:', command.id)
      shownCommandIdsRef.current.add(command.id)
      saveShownCommandId(command.id) // Persist to localStorage
      // Pick a random heading
      const randomHeading = HEADING_OPTIONS[Math.floor(Math.random() * HEADING_OPTIONS.length)]
      setHeading(randomHeading)
      setCountdown(20) // Reset countdown
      setCurrentCommand(command)
      setShowResult(true)
      showingResultRef.current = true
    }
  }

  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase) return
    
    console.log('PhotoTryoutResult: Setting up subscriptions (not checking old commands on mount)')

    // Don't check for old completed commands on mount - only listen for new ones

    // Also check periodically in case Realtime subscription misses the update
    // Only check for commands completed VERY recently (last 30 seconds) as a backup
    // This ensures we don't show old results on page reload
    const checkInterval = setInterval(async () => {
      // Only check if we're not already showing a result
      if (showingResultRef.current) {
        return
      }
      
      try {
        // Only check commands created AFTER component mount (to avoid showing old results)
        const mountTime = componentMountTimeRef.current.toISOString()
        const { data, error } = await supabase
          .from('photo_tryout_commands')
          .select('*')
          .eq('status', 'completed')
          .not('result_image_url', 'is', null)
          .gte('created_at', mountTime) // Only commands created after page load
          .order('created_at', { ascending: false })
          .limit(5) // Check up to 5 recent commands

        if (error) {
          console.error('PhotoTryoutResult: Polling query error:', error)
          return
        }

        if (data && data.length > 0) {
          // Find the first command we haven't shown yet
          for (const command of data) {
            if (shouldShowCommand(command)) {
              console.log('PhotoTryoutResult: Found new completed command via polling:', command.id, 'result_image_url length:', command.result_image_url?.length || 0)
              showCommand(command)
              break // Only show one at a time
            } else {
              console.log('PhotoTryoutResult: Polling found command but shouldShowCommand=false:', command.id, 'already shown?', shownCommandIdsRef.current.has(command.id), 'has result?', !!command.result_image_url)
            }
          }
        }
      } catch (err) {
        console.error('PhotoTryoutResult: Error in polling check:', err)
      }
    }, 1500) // Check every 1.5 seconds

    // Subscribe to completed commands
    const channel = supabase
      .channel('photo-tryout-result')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photo_tryout_commands',
          filter: 'status=eq.completed'
        },
        async (payload: any) => {
          console.log('PhotoTryoutResult: Received UPDATE event:', payload.new)
          console.log('PhotoTryoutResult: Command details - id:', payload.new.id, 'status:', payload.new.status, 'has result_image_url:', !!payload.new.result_image_url, 'result_image_url length:', payload.new.result_image_url?.length || 0)
          
          const commandId = payload.new.id
          const status = payload.new.status
          
          // If status is completed but result_image_url is missing (might be truncated in Realtime payload),
          // fetch the full command from database
          const hasResultUrl = payload.new.result_image_url && 
                              typeof payload.new.result_image_url === 'string' && 
                              payload.new.result_image_url.trim().length > 0
          
          if (status === 'completed' && !hasResultUrl) {
            console.log('PhotoTryoutResult: result_image_url missing/empty from Realtime payload, fetching from database')
            console.log('PhotoTryoutResult: result_image_url value:', payload.new.result_image_url, 'type:', typeof payload.new.result_image_url)
            try {
              const { data: fullCommand, error } = await supabase
                .from('photo_tryout_commands')
                .select('*')
                .eq('id', commandId)
                .single()
              
              if (error) {
                console.error('PhotoTryoutResult: Error fetching command:', error)
                return
              }
              
              console.log('PhotoTryoutResult: Fetched full command from database - has result_image_url:', !!fullCommand?.result_image_url, 'length:', fullCommand?.result_image_url?.length || 0)
              
              if (fullCommand && shouldShowCommand(fullCommand)) {
                console.log('PhotoTryoutResult: Fetched full command from database, showing result')
                showCommand(fullCommand)
                return
              } else {
                console.log('PhotoTryoutResult: Fetched command but shouldShowCommand returned false')
                console.log('PhotoTryoutResult: Command already shown?', shownCommandIdsRef.current.has(fullCommand?.id || ''))
                console.log('PhotoTryoutResult: Has result_image_url?', !!fullCommand?.result_image_url)
              }
            } catch (err) {
              console.error('PhotoTryoutResult: Exception fetching command:', err)
            }
            return
          }
          
          const command = payload.new as PhotoTryoutCommand
          
          // Check if result_image_url exists and is not empty
          const commandHasResultUrl = command.result_image_url && 
                                     typeof command.result_image_url === 'string' && 
                                     command.result_image_url.trim().length > 0
          
          if (!commandHasResultUrl) {
            console.log('PhotoTryoutResult: Command missing result_image_url in payload, will retry via polling')
            console.log('PhotoTryoutResult: result_image_url value:', command.result_image_url, 'type:', typeof command.result_image_url)
            return
          }
          
          if (shouldShowCommand(command)) {
            showCommand(command)
          } else {
            console.log('PhotoTryoutResult: Update received but command rejected by shouldShowCommand')
            console.log('PhotoTryoutResult: Shown command IDs:', Array.from(shownCommandIdsRef.current))
            console.log('PhotoTryoutResult: Current showingResultRef:', showingResultRef.current)
            console.log('PhotoTryoutResult: Command ID:', command.id, 'already shown?', shownCommandIdsRef.current.has(command.id))
            console.log('PhotoTryoutResult: Has result_image_url?', !!command.result_image_url)
          }
        }
      )
      .subscribe((status: string) => {
        console.log('PhotoTryoutResult: Subscription status:', status)
      })

    return () => {
      clearInterval(checkInterval)
      supabase.removeChannel(channel)
    }
  }, [])

  const handleClose = () => {
    setShowResult(false)
    setCurrentCommand(null)
    showingResultRef.current = false
    // Note: We keep the command ID in shownCommandIdsRef so we don't show it again
  }

  // Auto-close after 20 seconds when result is shown, with countdown
  useEffect(() => {
    if (showResult && currentCommand) {
      console.log('PhotoTryoutResult: Starting 20-second auto-close timer')
      setCountdown(20)
      
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      const closeTimer = setTimeout(() => {
        console.log('PhotoTryoutResult: Auto-closing after 20 seconds')
        setShowResult(false)
        setCurrentCommand(null)
        showingResultRef.current = false
        setCountdown(20)
      }, 20000) // 20 seconds

      return () => {
        clearInterval(countdownInterval)
        clearTimeout(closeTimer)
      }
    }
  }, [showResult, currentCommand])

  if (!showResult || !currentCommand || !currentCommand.result_image_url) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="relative max-w-4xl w-full mx-4">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300 z-10"
        >
          ×
        </button>
        <div className="bg-white rounded-lg p-6">
          {/* Heading */}
          <h2 className="text-3xl font-bold text-black mb-6 text-center">
            {heading}
          </h2>
          
          {/* Image */}
          <div className="relative mb-4">
            <img
              src={currentCommand.result_image_url}
              alt="Tryout Result"
              className="w-full rounded-lg"
            />
          </div>
          
          {/* Countdown timer - cleanly displayed below the image */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
              <span className="text-gray-600 text-sm">Auto-closing in</span>
              <div className="bg-gray-100 px-3 py-1 rounded-full">
                <span className="text-gray-800 font-bold text-lg tabular-nums">
                  {countdown}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
