'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function YouTubeSubmitPage() {
  const searchParams = useSearchParams()
  const commandId = searchParams.get('commandId')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!youtubeUrl.trim() || !commandId) return

    setSubmitting(true)
    setError('')
    const supabase = createClient()
    if (!supabase) {
      setError('Failed to connect to database')
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
        setError('Invalid YouTube URL. Please enter a valid YouTube link.')
        setSubmitting(false)
        return
      }

      // Update the command with the YouTube URL
      const { error: updateError } = await supabase
        .from('youtube_commands')
        .update({
          youtube_url: `https://www.youtube.com/embed/${videoId}`,
          status: 'completed'
        })
        .eq('id', commandId)

      if (updateError) {
        setError('Failed to submit URL. Please try again.')
        console.error('Error updating YouTube command:', updateError)
      } else {
        setSuccess(true)
        // Close window after 2 seconds
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.close()
          }
        }, 2000)
      }
    } catch (err) {
      setError('Failed to submit URL. Please try again.')
      console.error('Error submitting YouTube URL:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-4 text-center">
          Submit YouTube Video
        </h1>
        
        {success ? (
          <div className="text-center">
            <p className="text-green-400 mb-4">✓ URL submitted successfully!</p>
            <p className="text-gray-400 text-sm">This window will close automatically.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                YouTube URL
              </label>
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={submitting}
                required
              />
            </div>
            
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            
            <button
              type="submit"
              disabled={!youtubeUrl.trim() || submitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
