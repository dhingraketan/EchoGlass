'use client'

import { useState, useEffect } from 'react'

// Mock headlines - replace with real news API if needed
const mockHeadlines = [
  'Tech stocks surge on AI breakthrough',
  'Weather forecast: Sunny skies ahead',
  'Local traffic: Highway 101 clear',
  'Commute time: 15 minutes to downtown',
  'Market update: Dow Jones up 2%',
]

export default function NewsTicker() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % mockHeadlines.length)
    }, 5000) // Rotate every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-white">
      <div className="text-xs font-light text-white/60 mb-1 uppercase tracking-wide">News</div>
      <div className="text-sm font-light leading-relaxed">
        {mockHeadlines[currentIndex]}
      </div>
    </div>
  )
}
