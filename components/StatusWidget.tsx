'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CommandLog } from '@/lib/types'

export default function StatusWidget({ householdId }: { householdId: string }) {
  const [lastCommand, setLastCommand] = useState<CommandLog | null>(null)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced')

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    const fetchLastCommand = async () => {
      const { data, error } = await supabase
        .from('command_logs')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        // Table doesn't exist (404) or error - silently ignore
        if (error.code === 'PGRST116' || error.message?.includes('404') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          // Table doesn't exist - this is fine, just don't show last command
          return
        }
        console.warn('command_logs table error:', error)
      } else if (data) {
        setLastCommand(data)
      }
    }

    fetchLastCommand()

    // Subscribe to command logs (only if table exists)
    try {
      const channel = supabase
        .channel('command-logs-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'command_logs',
            filter: `household_id=eq.${householdId}`
          },
          () => {
            fetchLastCommand()
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

  const formatLastCommandTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex items-center gap-6 text-white text-xs font-light">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
        <span>Wi-Fi Connected</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${
          syncStatus === 'synced' ? 'bg-white' : 
          syncStatus === 'syncing' ? 'bg-white/50' : 
          'bg-white/30'
        }`}></span>
        <span>Sync: {syncStatus}</span>
      </div>
      {lastCommand && (
        <div className="flex items-center gap-2">
          <span className="text-white/60">Last Alexa: {formatLastCommandTime(lastCommand.created_at)}</span>
        </div>
      )}
    </div>
  )
}
