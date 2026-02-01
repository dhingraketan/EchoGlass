'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'

interface PhotoTryoutCommand {
  id: string
  created_at: string
  status: 'pending' | 'waiting_photo' | 'processing' | 'completed' | 'failed'
  tryout_type: 'photo' | 'video'
  clothing_url: string | null
  clothing_image_url: string | null
  user_photo_url: string | null
  result_image_url: string | null
  error_message: string | null
}

export default function PhotoTryoutQRPopup() {
  const [showPopup, setShowPopup] = useState(false)
  const [clothingInput, setClothingInput] = useState<string>('')
  const [clothingFile, setClothingFile] = useState<File | null>(null)
  const [currentCommand, setCurrentCommand] = useState<PhotoTryoutCommand | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [inputType, setInputType] = useState<'url' | 'file'>('url')
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase) {
      console.log('PhotoTryoutQRPopup: No Supabase client')
      return
    }

    console.log('PhotoTryoutQRPopup: Setting up subscriptions')

    // Check for pending photo tryout commands
    const checkForCommands = async () => {
      try {
        console.log('PhotoTryoutQRPopup: Checking for pending commands...')
        const { data, error } = await supabase
          .from('photo_tryout_commands')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
            console.log('PhotoTryoutQRPopup: photo_tryout_commands table does not exist yet')
            return
          }
          console.error('PhotoTryoutQRPopup: Error checking for commands:', error)
          return
        }

        console.log('PhotoTryoutQRPopup: Found commands:', data)
        if (data && data.length > 0) {
          console.log('PhotoTryoutQRPopup: Setting command and showing popup:', data[0])
          setCurrentCommand(data[0])
          setShowPopup(true)
        }
      } catch (err) {
        console.log('PhotoTryoutQRPopup: Exception checking commands:', err)
      }
    }

    checkForCommands()

    // Subscribe to new photo tryout commands
    const channel = supabase
      .channel('photo-tryout-commands', {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photo_tryout_commands',
          filter: 'status=eq.pending'
        },
        (payload: any) => {
          console.log('PhotoTryoutQRPopup: New command received via Realtime:', payload)
          setCurrentCommand(payload.new)
          setShowPopup(true)
        }
      )
      .subscribe((status: string) => {
        console.log('PhotoTryoutQRPopup: Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('PhotoTryoutQRPopup: Successfully subscribed to photo_tryout_commands INSERT events')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('PhotoTryoutQRPopup: Subscription error')
        }
      })

    // Subscribe to updates
    const updateChannel = supabase
      .channel('photo-tryout-commands-update')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photo_tryout_commands'
        },
        (payload: any) => {
          if (payload.new.status === 'waiting_photo') {
            // Close popup when clothing is submitted, ready for photo capture
            setShowPopup(false)
            setCurrentCommand(payload.new)
            setClothingInput('')
            setClothingFile(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(updateChannel)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setClothingFile(file)
    } else {
      alert('Please select an image file')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCommand) return

    if (inputType === 'url' && !clothingInput.trim()) {
      alert('Please enter a clothing URL')
      return
    }

    if (inputType === 'file' && !clothingFile) {
      alert('Please select an image file')
      return
    }

    setSubmitting(true)
    const supabase = supabaseRef.current
    if (!supabase) {
      setSubmitting(false)
      return
    }

    try {
      let clothingImageUrl: string

      if (inputType === 'url') {
        // Extract image from URL
        const extractResponse = await fetch('/api/photo-tryout/extract-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: clothingInput })
        })

        if (!extractResponse.ok) {
          const error = await extractResponse.json()
          throw new Error(error.error || 'Failed to extract image from URL')
        }

        const { imageUrl } = await extractResponse.json()
        clothingImageUrl = imageUrl

        // Update command with URL and extracted image URL
        const { error } = await supabase
          .from('photo_tryout_commands')
          .update({
            clothing_url: clothingInput,
            clothing_image_url: clothingImageUrl,
            status: 'waiting_photo'
          })
          .eq('id', currentCommand.id)

        if (error) {
          throw new Error(`Failed to update command: ${error.message}`)
        }
      } else {
        // Upload file to a temporary location or convert to data URL
        // For now, convert to base64 data URL
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64Data = reader.result as string
          
          // Update command with image data URL
          const { error } = await supabase
            .from('photo_tryout_commands')
            .update({
              clothing_image_url: base64Data,
              status: 'waiting_photo'
            })
            .eq('id', currentCommand.id)

          if (error) {
            console.error('Error updating command:', error)
            alert('Failed to submit image. Please try again.')
            setSubmitting(false)
          } else {
            setSubmitting(false)
          }
        }
        reader.onerror = () => {
          alert('Failed to read file')
          setSubmitting(false)
        }
        reader.readAsDataURL(clothingFile!)
        return
      }
    } catch (err: any) {
      console.error('Error submitting clothing:', err)
      alert(err.message || 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!showPopup || !currentCommand) {
    return null
  }

  // Generate QR code URL that points to a simple form page
  const qrCodeUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/photo-tryout-submit?commandId=${currentCommand.id}`
    : ''

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-black mb-4 text-center">
          Submit Clothing for Photo Tryout
        </h2>
        
        <div className="flex flex-col items-center mb-6">
          {qrCodeUrl && (
            <div className="bg-white p-4 rounded-lg mb-4">
              <QRCodeSVG value={qrCodeUrl} size={256} />
            </div>
          )}
          
          <p className="text-sm text-gray-600 text-center mb-4">
            Or submit directly:
          </p>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputType('url')}
              className={`px-4 py-2 rounded-lg ${
                inputType === 'url' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              URL
            </button>
            <button
              onClick={() => setInputType('file')}
              className={`px-4 py-2 rounded-lg ${
                inputType === 'file' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Photo
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="w-full">
            {inputType === 'url' ? (
              <input
                type="text"
                value={clothingInput || ''}
                onChange={(e) => setClothingInput(e.target.value || '')}
                placeholder="https://example.com/clothing-post"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black mb-4"
                disabled={submitting}
              />
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black mb-4"
                disabled={submitting}
              />
            )}
            <button
              type="submit"
              disabled={submitting || (inputType === 'url' && !clothingInput.trim()) || (inputType === 'file' && !clothingFile)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
