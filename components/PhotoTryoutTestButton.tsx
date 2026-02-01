'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PhotoTryoutTestButton() {
  const [loading, setLoading] = useState(false)

  const handleTest = async () => {
    setLoading(true)
    const supabase = createClient()
    if (!supabase) {
      alert('Failed to connect to database')
      setLoading(false)
      return
    }

    try {
      // Create a test photo tryout command (simulating what Alexa would do)
      const { error } = await supabase
        .from('photo_tryout_commands')
        .insert({
          status: 'pending',
          tryout_type: 'photo'
        })

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
          alert('photo_tryout_commands table does not exist. Please run the migration first.')
        } else {
          alert(`Failed to create test command: ${error.message}`)
        }
      } else {
        // Success - the PhotoTryoutQRPopup component will automatically detect it via Realtime
        console.log('Test photo tryout command created successfully')
      }
    } catch (error: any) {
      console.error('Error creating test command:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleTest}
      disabled={loading}
      className="fixed top-4 right-4 bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed z-40 shadow-lg"
    >
      {loading ? 'Creating...' : 'Test Photo Tryout'}
    </button>
  )
}
