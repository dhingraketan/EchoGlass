'use client'

import { useState, useEffect } from 'react'

export default function TimeWidget() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }))
      setDate(now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-white">
      {/* Date first, then time below - matching smart mirror style */}
      <div className="text-xl font-normal text-white/90 mb-4 uppercase tracking-wide">{date}</div>
      <div className="text-7xl font-normal tracking-tight leading-none">{time}</div>
    </div>
  )
}
