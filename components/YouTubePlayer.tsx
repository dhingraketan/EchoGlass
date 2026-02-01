'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import MotivationalQuote from './MotivationalQuote'

export default function YouTubePlayer() {
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    // Get the most recent completed YouTube command
    const fetchCurrentVideo = async () => {
      try {
        const { data, error } = await supabase
          .from('youtube_commands')
          .select('youtube_url')
          .eq('status', 'completed')
          .not('youtube_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          // Table doesn't exist or RLS issue
          if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
            console.log('youtube_commands table does not exist yet')
            return
          }
          console.error('Error fetching YouTube video:', error)
          return
        }

        if (data && data.length > 0 && data[0].youtube_url) {
          setYoutubeUrl(data[0].youtube_url)
        }
      } catch (err) {
        // Table might not exist or no video found
        console.log('No YouTube video found or table does not exist')
      }
    }

    fetchCurrentVideo()

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
          if (payload.new.youtube_url) {
            setYoutubeUrl(payload.new.youtube_url)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Show YouTube player if URL exists, otherwise show motivational quote
  if (youtubeUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <iframe
          src={`${youtubeUrl}?autoplay=1&controls=1&rel=0`}
          className="w-full h-full max-w-4xl aspect-video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video player"
        />
      </div>
    )
  }

  return <MotivationalQuote />
}
