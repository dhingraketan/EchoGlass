'use client'

import { hasSupabaseConfig } from '@/lib/supabase/client'
import SetupScreen from '@/components/SetupScreen'
import TimeWidget from '@/components/TimeWidget'
import WeatherWidget from '@/components/WeatherWidget'
import CalendarWidget from '@/components/CalendarWidget'
import TodoWidget from '@/components/TodoWidget'
import StatusWidget from '@/components/StatusWidget'
import NewsTicker from '@/components/NewsTicker'
import StockTicker from '@/components/StockTicker'
import YouTubePlayer from '@/components/YouTubePlayer'
import YouTubeQRPopup from '@/components/YouTubeQRPopup'

export default function DashboardPage() {
  const householdId = process.env.NEXT_PUBLIC_HOUSEHOLD_ID || 'default-household'

  // Show setup screen if env vars are missing
  if (!hasSupabaseConfig()) {
    return <SetupScreen />
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {/* Smart Mirror Layout - Information overlays positioned around edges */}
      <div className="h-full w-full p-8">
        {/* Top Left - Date & Time */}
        <div className="absolute top-8 left-8">
          <TimeWidget />
        </div>

        {/* Below Time - Calendar */}
        <div className="absolute top-48 left-8 w-80">
          <CalendarWidget householdId={householdId} />
        </div>

        {/* Right Side - Weather above Todos */}
        <div className="absolute top-8 right-8 w-80">
          <WeatherWidget />
        </div>

        {/* Right Side - Todos below Weather */}
        <div className="absolute top-[28rem] bottom-32 overflow-y-auto pr-8" style={{ right: '-32px', width: '320px' }}>
          <TodoWidget householdId={householdId} />
        </div>

        {/* Center - YouTube Player or Motivational Quote */}
        <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3">
          <YouTubePlayer />
        </div>

        {/* YouTube QR Code Popup */}
        <YouTubeQRPopup />

        {/* Bottom Left - Status */}
        <div className="absolute bottom-28 left-8 right-96">
          <StatusWidget householdId={householdId} />
        </div>

        {/* Bottom Right - News Ticker */}
        <div className="absolute bottom-28 right-8 w-80">
          <NewsTicker />
        </div>

        {/* Bottom - Stock/Crypto Ticker */}
        <div className="absolute bottom-0 left-0 right-0 px-8 py-2">
          <StockTicker />
        </div>
      </div>
    </div>
  )
}
