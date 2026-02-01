'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'

interface YouTubeCommand {
  id: string
  created_at: string
  status: 'pending' | 'completed'
  youtube_url: string | null
}

export default function YouTubeQRPopup() {
  const [showPopup, setShowPopup] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [currentCommand, setCurrentCommand] = useState<YouTubeCommand | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    // Check for pending YouTube commands
    const checkForCommands = async () => {
      try {
        const { data, error } = await supabase
          .from('youtube_commands')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          // Table doesn't exist or RLS issue
          if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
            console.log('youtube_commands table does not exist yet')
            return
          }
          console.error('Error checking for YouTube commands:', error)
          return
        }

        if (data && data.length > 0) {
          setCurrentCommand(data[0])
          setShowPopup(true)
        }
      } catch (err) {
        // Table might not exist, ignore
        console.log('youtube_commands table does not exist yet')
      }
    }

    checkForCommands()

    // Subscribe to new YouTube commands
    const channel = supabase
      .channel('youtube-commands')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'youtube_commands',
          filter: 'status=eq.pending'
        },
        (payload: any) => {
          console.log('New YouTube command received:', payload)
          setCurrentCommand(payload.new)
          setShowPopup(true)
        }
      )
      .subscribe()

    // Also subscribe to updates (when URL is submitted)
    const updateChannel = supabase
      .channel('youtube-commands-update')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'youtube_commands'
        },
        (payload: any) => {
          if (payload.new.status === 'completed' && payload.new.youtube_url) {
            // Close popup when URL is submitted
            setShowPopup(false)
            setCurrentCommand(null)
            setYoutubeUrl('')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(updateChannel)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!youtubeUrl.trim() || !currentCommand) return

    setSubmitting(true)
    const supabase = createClient()
    if (!supabase) {
      setSubmitting(false)
      return
    }

    try {
      // Extract YouTube video ID from URL
      let videoId = ''
      const urlPatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/
      ]

      for (const pattern of urlPatterns) {
        const match = youtubeUrl.match(pattern)
        if (match && match[1]) {
          videoId = match[1]
          break
        }
      }

      if (!videoId) {
        alert('Invalid YouTube URL. Please enter a valid YouTube link.')
        setSubmitting(false)
        return
      }

      // Update the command with the YouTube URL
      const { error } = await supabase
        .from('youtube_commands')
        .update({
          youtube_url: `https://www.youtube.com/embed/${videoId}`,
          status: 'completed'
        })
        .eq('id', currentCommand.id)

      if (error) {
        console.error('Error updating YouTube command:', error)
        alert('Failed to submit URL. Please try again.')
      } else {
        // Popup will close automatically via Realtime subscription
        setYoutubeUrl('')
      }
    } catch (err) {
      console.error('Error submitting YouTube URL:', err)
      alert('Failed to submit URL. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!showPopup || !currentCommand) return null

  // Generate QR code URL that points to a simple form page
  const qrCodeUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/youtube-submit?commandId=${currentCommand.id}`
    : ''

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-black mb-4 text-center">
          Scan QR Code to Submit YouTube Link
        </h2>
        
        <div className="flex flex-col items-center mb-6">
          {qrCodeUrl && (
            <div className="bg-white p-4 rounded-lg mb-4">
              <QRCodeSVG value={qrCodeUrl} size={256} />
            </div>
          )}
          
          <p className="text-sm text-gray-600 text-center mb-4">
            Or enter the YouTube URL directly:
          </p>
          
          <form onSubmit={handleSubmit} className="w-full">
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black mb-4"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={!youtubeUrl.trim() || submitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
