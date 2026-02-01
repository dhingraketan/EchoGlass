'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    // Check for completed commands
    const checkForResults = async () => {
      try {
        const { data, error } = await supabase
          .from('photo_tryout_commands')
          .select('*')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          if (error.code === 'PGRST116' || error.code === '42P01') {
            return
          }
          console.error('Error checking for results:', error)
          return
        }

        if (data && data.length > 0 && data[0].result_image_url) {
          setCurrentCommand(data[0])
          setShowResult(true)
        }
      } catch (err) {
        console.log('Exception checking results:', err)
      }
    }

    checkForResults()

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
          if (payload.new.result_image_url) {
            setCurrentCommand(payload.new)
            setShowResult(true)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleClose = () => {
    setShowResult(false)
    setCurrentCommand(null)
  }

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
