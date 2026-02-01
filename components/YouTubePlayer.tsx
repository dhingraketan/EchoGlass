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

    // Subscribe to updates when new videos are submitted
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
          console.log('YouTube video submitted via Realtime:', payload.new)
          if (payload.new.youtube_url) {
            setYoutubeUrl(payload.new.youtube_url)
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
