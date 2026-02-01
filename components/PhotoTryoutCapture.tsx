'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PhotoTryoutCommand {
  id: string
  status: 'pending' | 'waiting_photo' | 'processing' | 'completed' | 'failed'
  clothing_image_url: string | null
}

export default function PhotoTryoutCapture() {
  const [showCapture, setShowCapture] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [currentCommand, setCurrentCommand] = useState<PhotoTryoutCommand | null>(null)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    // Check for commands waiting for photo
    const checkForCommands = async () => {
      try {
        const { data, error } = await supabase
          .from('photo_tryout_commands')
          .select('*')
          .eq('status', 'waiting_photo')
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) {
          if (error.code === 'PGRST116' || error.code === '42P01') {
            return
          }
          console.error('Error checking for photo tryout commands:', error)
          return
        }

        if (data && data.length > 0) {
          setCurrentCommand(data[0])
          setShowCapture(true)
          startCamera()
        }
      } catch (err) {
        console.log('Exception checking commands:', err)
      }
    }

    checkForCommands()

    // Subscribe to status changes
    const channel = supabase
      .channel('photo-tryout-capture')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photo_tryout_commands',
          filter: 'status=eq.waiting_photo'
        },
        (payload: any) => {
          setCurrentCommand(payload.new)
          setShowCapture(true)
          if (!streamRef.current) {
            startCamera()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      stopCamera()
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Failed to access camera. Please check permissions.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const startCountdown = () => {
    setCountdown(5)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          capturePhoto()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedPhoto(photoDataUrl)
    
    // Stop camera
    stopCamera()

    // Upload photo and update command
    uploadPhoto(photoDataUrl)
  }

  const uploadPhoto = async (photoDataUrl: string) => {
    if (!currentCommand) return

    const supabase = createClient()
    if (!supabase) return

    try {
      // Update command with user photo
      const { error } = await supabase
        .from('photo_tryout_commands')
        .update({
          user_photo_url: photoDataUrl,
          status: 'processing'
        })
        .eq('id', currentCommand.id)

      if (error) {
        throw new Error(`Failed to upload photo: ${error.message}`)
      }

      // Trigger image generation
      await generateImage(currentCommand.id, photoDataUrl, currentCommand.clothing_image_url!)
    } catch (error: any) {
      console.error('Error uploading photo:', error)
      alert('Failed to capture photo. Please try again.')
    }
  }

  const generateImage = async (commandId: string, userPhotoUrl: string, clothingImageUrl: string) => {
    try {
      const response = await fetch('/api/photo-tryout/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPhotoUrl,
          clothingImageUrl
        })
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error('API error response:', responseData)
        throw new Error(responseData.error || 'Failed to generate image')
      }

      const { imageData, mimeType } = responseData
      if (!imageData) {
        throw new Error('No image data in response')
      }
      
      const resultImageUrl = `data:${mimeType};base64,${imageData}`

      // Update command with result
      const supabase = createClient()
      if (!supabase) return

      await supabase
        .from('photo_tryout_commands')
        .update({
          result_image_url: resultImageUrl,
          status: 'completed'
        })
        .eq('id', commandId)

      // Close capture view
      setShowCapture(false)
      setCurrentCommand(null)
      setCapturedPhoto(null)
    } catch (error: any) {
      console.error('Error generating image:', error)
      const supabase = createClient()
      if (supabase) {
        await supabase
          .from('photo_tryout_commands')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', commandId)
      }
      alert('Failed to generate image. Please try again.')
    }
  }

  const handleClose = () => {
    setShowCapture(false)
    setCurrentCommand(null)
    setCapturedPhoto(null)
    stopCamera()
  }

  if (!showCapture || !currentCommand) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="relative w-full h-full flex items-center justify-center">
        {capturedPhoto ? (
          <div className="text-center">
            <img src={capturedPhoto} alt="Captured" className="max-w-full max-h-[80vh] rounded-lg mb-4" />
            <p className="text-white text-lg">Processing...</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-w-full max-h-[80vh] rounded-lg"
              style={{ transform: 'scaleX(-1)' }} // Mirror the video
            />
            {countdown !== null ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-9xl font-bold">
                  {countdown}
                </div>
              </div>
            ) : (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                <button
                  onClick={startCountdown}
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg text-xl font-bold hover:bg-blue-700"
                >
                  Take Photo
                </button>
                <button
                  onClick={handleClose}
                  className="bg-gray-600 text-white px-8 py-4 rounded-lg text-xl font-bold hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
