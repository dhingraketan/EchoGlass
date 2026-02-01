'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PhotoTryoutCommand {
  id: string
  status: 'pending' | 'waiting_photo' | 'processing' | 'completed' | 'failed'
  result_image_url: string | null
  error_message: string | null
}

export default function PhotoTryoutResult() {
  const [showResult, setShowResult] = useState(false)
  const [currentCommand, setCurrentCommand] = useState<PhotoTryoutCommand | null>(null)
  const supabaseRef = useRef(createClient())
  const showingResultRef = useRef(false)
  const shownCommandIdsRef = useRef<Set<string>>(new Set())
  const componentMountTimeRef = useRef<Date>(new Date())

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
    // Only check for commands completed very recently (last 30 seconds) as a backup
    const checkInterval = setInterval(async () => {
      if (!showingResultRef.current) {
        // Only check if we're not already showing a result
        try {
          // Only check commands created in the last 30 seconds (as a backup for Realtime)
          const recentTime = new Date(Date.now() - 30000).toISOString()
          const { data, error } = await supabase
            .from('photo_tryout_commands')
            .select('*')
            .eq('status', 'completed')
            .not('result_image_url', 'is', null)
            .gte('created_at', recentTime) // Only very recent commands
            .order('created_at', { ascending: false })
            .limit(1)

          if (!error && data && data.length > 0) {
            const command = data[0]
            if (shouldShowCommand(command)) {
              console.log('PhotoTryoutResult: Found new completed command via polling:', command.id)
              showCommand(command)
            }
          }
        } catch (err) {
          // Silently fail - this is just a backup check
        }
      }
    }, 2000) // Check every 2 seconds (less frequent since Realtime should catch it)

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
        (payload: any) => {
          console.log('PhotoTryoutResult: Received UPDATE event:', payload.new)
          const command = payload.new as PhotoTryoutCommand
          if (shouldShowCommand(command)) {
            showCommand(command)
          } else {
            console.log('PhotoTryoutResult: Update received but command already shown or invalid')
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

  // Auto-close after 20 seconds when result is shown
  useEffect(() => {
    if (showResult && currentCommand) {
      console.log('PhotoTryoutResult: Starting 20-second auto-close timer')
      const timer = setTimeout(() => {
        console.log('PhotoTryoutResult: Auto-closing after 20 seconds')
        setShowResult(false)
        setCurrentCommand(null)
        showingResultRef.current = false
      }, 20000) // 20 seconds

      return () => {
        clearTimeout(timer)
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
        <div className="bg-white rounded-lg p-4">
          <h2 className="text-2xl font-bold text-black mb-4 text-center">
            Photo Tryout Result
          </h2>
          <img
            src={currentCommand.result_image_url}
            alt="Tryout Result"
            className="w-full rounded-lg"
          />
        </div>
      </div>
    </div>
  )
}
