'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import MotivationalQuote from './MotivationalQuote'

export default function YouTubePlayer() {
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    // Don't load existing videos on page refresh - only show new ones via Realtime
    // This ensures the dashboard goes back to motivational quotes on refresh

    // Subscribe to updates when new videos are submitted or closed
    const channel = supabase
      .channel('youtube-player-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'youtube_commands',
          filter: 'status=eq.completed'
        },
        (payload: any) => {
          console.log('YouTube command updated via Realtime:', payload.new)
          if (payload.new.youtube_url) {
            // Video URL is set - show the video
            console.log('Setting YouTube URL:', payload.new.youtube_url)
            setYoutubeUrl(payload.new.youtube_url)
          } else {
            // Video URL is null or empty - close the video and show motivational quote
            console.log('YouTube URL cleared - closing video and showing motivational quote')
            setYoutubeUrl(null)
          }
        }
      )
      .subscribe((status: string) => {
        console.log('YouTube player subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Show YouTube player if URL exists, otherwise show motivational quote
  if (youtubeUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <iframe
          src={`${youtubeUrl}?autoplay=1&controls=1&rel=0`}
          className="w-full h-full max-w-6xl aspect-video rounded-2xl shadow-2xl"
          style={{ borderRadius: '24px' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video player"
        />
      </div>
    )
  }

  return <MotivationalQuote />
}
