'use client'

import { useState, useEffect } from 'react'

const motivationalQuotes = [
  "Every day is a new beginning.",
  "Believe you can and you're halfway there.",
  "The only way to do great work is to love what you do.",
  "Success is not final, failure is not fatal.",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Dream it. Wish it. Do it.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Dream bigger. Do bigger.",
  "Don't stop when you're tired. Stop when you're done.",
  "Wake up with determination. Go to bed with satisfaction.",
  "Do something today that your future self will thank you for.",
  "Little things make big things happen.",
]

export default function MotivationalQuote() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false)
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % motivationalQuotes.length)
        setIsVisible(true)
      }, 500) // Half of transition duration
    }, 10000) // Change every 10 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-center h-full w-full px-8">
      <div 
        className={`text-white text-center transition-all duration-1000 ease-in-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="text-4xl font-light leading-relaxed">
          {motivationalQuotes[currentIndex]}
        </div>
      </div>
    </div>
  )
}
