'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PhotoTryoutCommand {
  id: string
  status: 'pending' | 'waiting_photo' | 'processing' | 'completed' | 'failed'
  clothing_url: string | null
  clothing_image_url: string | null
  result_image_url: string | null
  error_message: string | null
}

const HEADING_OPTIONS = [
  "What do you think?",
  "Looks cool!",
  "How's this?",
  "Pretty nice, right?",
  "What's your take?",
  "Looking good!",
  "Check this out!",
  "Not bad, eh?"
]

export default function PhotoTryoutResult() {
  const [showResult, setShowResult] = useState(false)
  const [currentCommand, setCurrentCommand] = useState<PhotoTryoutCommand | null>(null)
  const [countdown, setCountdown] = useState(20)
  const [heading, setHeading] = useState("What do you think?")
  const [showGesturePrompt, setShowGesturePrompt] = useState(false)
  const [gestureCountdown, setGestureCountdown] = useState(10)
  const [gestureResult, setGestureResult] = useState<'yes' | 'no' | 'pending'>('pending')
  const supabaseRef = useRef(createClient())
  const showingResultRef = useRef(false)
  const componentMountTimeRef = useRef<Date>(new Date())
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const headPositionRef = useRef<{ x: number; y: number }[]>([])
  
  // Load shown command IDs from localStorage on mount
  const loadShownCommandIds = (): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('photoTryoutShownCommandIds')
      if (stored) {
        const ids = JSON.parse(stored) as string[]
        // Only keep IDs from the last 24 hours to prevent localStorage from growing too large
        return new Set(ids)
      }
    } catch (err) {
      console.error('PhotoTryoutResult: Error loading shown command IDs:', err)
    }
    return new Set()
  }
  
  const saveShownCommandId = (id: string) => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('photoTryoutShownCommandIds')
      const ids = stored ? JSON.parse(stored) as string[] : []
      if (!ids.includes(id)) {
        ids.push(id)
        // Keep only last 100 IDs to prevent localStorage from growing too large
        const trimmedIds = ids.slice(-100)
        localStorage.setItem('photoTryoutShownCommandIds', JSON.stringify(trimmedIds))
      }
    } catch (err) {
      console.error('PhotoTryoutResult: Error saving shown command ID:', err)
    }
  }
  
  const shownCommandIdsRef = useRef<Set<string>>(loadShownCommandIds())

  // Helper function to check if we should show a command
  const shouldShowCommand = (command: PhotoTryoutCommand): boolean => {
    // Don't show if we've already shown this command
    if (shownCommandIdsRef.current.has(command.id)) {
      return false
    }
    
    // Only show if it has a result image
    if (!command.result_image_url) {
      return false
    }
    
    return true
  }

  // Helper function to show a command
  const showCommand = useCallback((command: PhotoTryoutCommand) => {
    if (shouldShowCommand(command)) {
      console.log('PhotoTryoutResult: Showing result for command:', command.id)
      shownCommandIdsRef.current.add(command.id)
      saveShownCommandId(command.id) // Persist to localStorage
      // Pick a random heading
      const randomHeading = HEADING_OPTIONS[Math.floor(Math.random() * HEADING_OPTIONS.length)]
      setHeading(randomHeading)
      setCountdown(20) // Reset countdown
      setCurrentCommand(command)
      setShowResult(true)
      showingResultRef.current = true
    }
  }, [])

  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase) return
    
    console.log('PhotoTryoutResult: Setting up subscriptions (not checking old commands on mount)')

    // Don't check for old completed commands on mount - only listen for new ones

    // Also check periodically in case Realtime subscription misses the update
    // Only check for commands completed VERY recently (last 30 seconds) as a backup
    // This ensures we don't show old results on page reload
    const checkInterval = setInterval(async () => {
      // Only check if we're not already showing a result
      if (showingResultRef.current) {
        return
      }
      
      try {
        // Only check commands created AFTER component mount (to avoid showing old results)
        const mountTime = componentMountTimeRef.current.toISOString()
        const { data, error } = await supabase
          .from('photo_tryout_commands')
          .select('*')
          .eq('status', 'completed')
          .not('result_image_url', 'is', null)
          .gte('created_at', mountTime) // Only commands created after page load
          .order('created_at', { ascending: false })
          .limit(5) // Check up to 5 recent commands

        if (error) {
          console.error('PhotoTryoutResult: Polling query error:', error)
          return
        }

        if (data && data.length > 0) {
          // Find the first command we haven't shown yet
          for (const command of data) {
            if (shouldShowCommand(command)) {
              console.log('PhotoTryoutResult: Found new completed command via polling:', command.id, 'result_image_url length:', command.result_image_url?.length || 0)
              showCommand(command)
              break // Only show one at a time
            } else {
              console.log('PhotoTryoutResult: Polling found command but shouldShowCommand=false:', command.id, 'already shown?', shownCommandIdsRef.current.has(command.id), 'has result?', !!command.result_image_url)
            }
          }
        }
      } catch (err) {
        console.error('PhotoTryoutResult: Error in polling check:', err)
      }
    }, 1500) // Check every 1.5 seconds

    // Subscribe to completed commands
    const channel = supabase
      .channel('photo-tryout-result')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photo_tryout_commands',
          filter: 'status=eq.completed'
        },
        async (payload: any) => {
          console.log('PhotoTryoutResult: Received UPDATE event:', payload.new)
          console.log('PhotoTryoutResult: Command details - id:', payload.new.id, 'status:', payload.new.status, 'has result_image_url:', !!payload.new.result_image_url, 'result_image_url length:', payload.new.result_image_url?.length || 0)
          
          const commandId = payload.new.id
          const status = payload.new.status
          
          // If status is completed but result_image_url is missing (might be truncated in Realtime payload),
          // fetch the full command from database
          const hasResultUrl = payload.new.result_image_url && 
                              typeof payload.new.result_image_url === 'string' && 
                              payload.new.result_image_url.trim().length > 0
          
          if (status === 'completed' && !hasResultUrl) {
            console.log('PhotoTryoutResult: result_image_url missing/empty from Realtime payload, fetching from database')
            console.log('PhotoTryoutResult: result_image_url value:', payload.new.result_image_url, 'type:', typeof payload.new.result_image_url)
            try {
              const { data: fullCommand, error } = await supabase
                .from('photo_tryout_commands')
                .select('*')
                .eq('id', commandId)
                .single()
              
              if (error) {
                console.error('PhotoTryoutResult: Error fetching command:', error)
                return
              }
              
              console.log('PhotoTryoutResult: Fetched full command from database - has result_image_url:', !!fullCommand?.result_image_url, 'length:', fullCommand?.result_image_url?.length || 0)
              
              if (fullCommand && shouldShowCommand(fullCommand)) {
                console.log('PhotoTryoutResult: Fetched full command from database, showing result')
                showCommand(fullCommand)
                return
              } else {
                console.log('PhotoTryoutResult: Fetched command but shouldShowCommand returned false')
                console.log('PhotoTryoutResult: Command already shown?', shownCommandIdsRef.current.has(fullCommand?.id || ''))
                console.log('PhotoTryoutResult: Has result_image_url?', !!fullCommand?.result_image_url)
              }
            } catch (err) {
              console.error('PhotoTryoutResult: Exception fetching command:', err)
            }
            return
          }
          
          const command = payload.new as PhotoTryoutCommand
          
          // Check if result_image_url exists and is not empty
          const commandHasResultUrl = command.result_image_url && 
                                     typeof command.result_image_url === 'string' && 
                                     command.result_image_url.trim().length > 0
          
          if (!commandHasResultUrl) {
            console.log('PhotoTryoutResult: Command missing result_image_url in payload, will retry via polling')
            console.log('PhotoTryoutResult: result_image_url value:', command.result_image_url, 'type:', typeof command.result_image_url)
            return
          }
          
          if (shouldShowCommand(command)) {
            showCommand(command)
          } else {
            console.log('PhotoTryoutResult: Update received but command rejected by shouldShowCommand')
            console.log('PhotoTryoutResult: Shown command IDs:', Array.from(shownCommandIdsRef.current))
            console.log('PhotoTryoutResult: Current showingResultRef:', showingResultRef.current)
            console.log('PhotoTryoutResult: Command ID:', command.id, 'already shown?', shownCommandIdsRef.current.has(command.id))
            console.log('PhotoTryoutResult: Has result_image_url?', !!command.result_image_url)
          }
        }
      )
      .subscribe((status: string) => {
        console.log('PhotoTryoutResult: Subscription status:', status)
      })

    return () => {
      clearInterval(checkInterval)
      supabase.removeChannel(channel)
    }
  }, [showCommand])

  const handleClose = () => {
    setShowResult(false)
    setCurrentCommand(null)
    showingResultRef.current = false
    // Note: We keep the command ID in shownCommandIdsRef so we don't show it again
  }

  const handleGestureResult = useCallback(async (result: 'yes' | 'no') => {
    setGestureResult(result)
    
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (result === 'yes' && currentCommand) {
      // Save to closet table
      try {
        const supabase = supabaseRef.current
        if (supabase) {
          const { error } = await supabase
            .from('closet')
            .insert({
              clothing_url: currentCommand.clothing_url || null,
              clothing_image_url: currentCommand.clothing_image_url || '',
              tryout_result_image_url: currentCommand.result_image_url || null,
              tryout_command_id: currentCommand.id
            })

          if (error) {
            console.error('Error saving to closet:', error)
          } else {
            console.log('Item saved to closet successfully')
          }
        }
      } catch (err) {
        console.error('Error saving to closet:', err)
      }
    }

    // Close after showing result briefly
    setTimeout(() => {
      setShowResult(false)
      setShowGesturePrompt(false)
      setCurrentCommand(null)
      showingResultRef.current = false
      setCountdown(20)
      setGestureCountdown(10)
      setGestureResult('pending')
      headPositionRef.current = []
    }, 2000)
  }, [currentCommand])

  const detectHeadMovement = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('PhotoTryoutResult: Video or canvas ref missing')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Ensure video is ready
    if (video.readyState < 2) {
      console.log('PhotoTryoutResult: Video not ready, waiting...')
      setTimeout(() => detectHeadMovement(), 100)
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      console.error('PhotoTryoutResult: Could not get canvas context')
      return
    }

    // Set canvas size to match video
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      console.log(`PhotoTryoutResult: Canvas size set to ${canvas.width}x${canvas.height}`)
    } else {
      console.error('PhotoTryoutResult: Video dimensions invalid')
      return
    }

    // Simple motion-based head movement detection
    let previousFrame: ImageData | null = null
    let motionHistory: { vertical: number; horizontal: number; timestamp: number }[] = []
    let nodCount = 0
    let shakeCount = 0
    let frameCount = 0
    const motionThreshold = 20 // Lower threshold for better sensitivity

    const detect = () => {
      if (!videoRef.current || !canvasRef.current || gestureResult !== 'pending') {
        console.log('PhotoTryoutResult: Detection stopped')
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        return
      }

      // Check video is still playing
      if (video.readyState < 2 || video.paused) {
        console.log('PhotoTryoutResult: Video not ready or paused')
        animationFrameRef.current = requestAnimationFrame(detect)
        return
      }

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height)

        if (previousFrame) {
          // Focus on center region where face typically is
          const centerX = Math.floor(canvas.width / 2)
          const centerY = Math.floor(canvas.height / 2)
          const regionSize = 150

          let verticalMotion = 0
          let horizontalMotion = 0
          let sampleCount = 0

          // Sample motion in center region
          for (let y = centerY - regionSize; y < centerY + regionSize; y += 8) {
            for (let x = centerX - regionSize; x < centerX + regionSize; x += 8) {
              if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                const idx = (y * canvas.width + x) * 4
                const prevIdx = idx
                
                // Calculate brightness difference
                const currentBrightness = (
                  currentFrame.data[idx] + 
                  currentFrame.data[idx + 1] + 
                  currentFrame.data[idx + 2]
                ) / 3
                
                const prevBrightness = (
                  previousFrame.data[prevIdx] + 
                  previousFrame.data[prevIdx + 1] + 
                  previousFrame.data[prevIdx + 2]
                ) / 3
                
                const diff = Math.abs(currentBrightness - prevBrightness)
                
                // Determine if motion is more vertical or horizontal based on position
                const distFromCenterX = Math.abs(x - centerX)
                const distFromCenterY = Math.abs(y - centerY)
                
                if (distFromCenterY < distFromCenterX) {
                  // More horizontal motion
                  horizontalMotion += diff
                } else {
                  // More vertical motion
                  verticalMotion += diff
                }
                
                sampleCount++
              }
            }
          }

          // Normalize motion values
          const avgVerticalMotion = verticalMotion / sampleCount
          const avgHorizontalMotion = horizontalMotion / sampleCount

          frameCount++
          
          // Analyze motion every 5 frames
          if (frameCount % 5 === 0) {
            const timestamp = Date.now()
            motionHistory.push({
              vertical: avgVerticalMotion,
              horizontal: avgHorizontalMotion,
              timestamp
            })

            // Keep only last 2 seconds of motion history
            motionHistory = motionHistory.filter(m => timestamp - m.timestamp < 2000)

            if (motionHistory.length >= 10) {
              // Analyze recent motion patterns
              const recentVertical = motionHistory.slice(-10).map(m => m.vertical)
              const recentHorizontal = motionHistory.slice(-10).map(m => m.horizontal)

              // Calculate variance to detect consistent movement
              const avgV = recentVertical.reduce((a, b) => a + b, 0) / recentVertical.length
              const varianceV = recentVertical.reduce((sum, v) => sum + Math.pow(v - avgV, 2), 0) / recentVertical.length

              const avgH = recentHorizontal.reduce((a, b) => a + b, 0) / recentHorizontal.length
              const varianceH = recentHorizontal.reduce((sum, h) => sum + Math.pow(h - avgH, 2), 0) / recentHorizontal.length

              // Detect nodding (vertical movement pattern)
              if (varianceV > motionThreshold && avgV > motionThreshold / 2) {
                nodCount++
                shakeCount = Math.max(0, shakeCount - 1)
                console.log(`PhotoTryoutResult: Nodding detected - count: ${nodCount}, varianceV: ${varianceV.toFixed(2)}, avgV: ${avgV.toFixed(2)}`)
                if (nodCount >= 5) {
                  console.log('PhotoTryoutResult: Nodding confirmed - YES')
                  handleGestureResult('yes')
                  return
                }
              } else {
                nodCount = Math.max(0, nodCount - 1)
              }

              // Detect shaking (horizontal movement pattern)
              if (varianceH > motionThreshold && avgH > motionThreshold / 2) {
                shakeCount++
                nodCount = Math.max(0, nodCount - 1)
                console.log(`PhotoTryoutResult: Shaking detected - count: ${shakeCount}, varianceH: ${varianceH.toFixed(2)}, avgH: ${avgH.toFixed(2)}`)
                if (shakeCount >= 5) {
                  console.log('PhotoTryoutResult: Shaking confirmed - NO')
                  handleGestureResult('no')
                  return
                }
              } else {
                shakeCount = Math.max(0, shakeCount - 1)
              }
              
              // Log motion stats every 30 frames for debugging
              if (frameCount % 30 === 0) {
                console.log(`PhotoTryoutResult: Motion stats - V: ${avgV.toFixed(2)} (var: ${varianceV.toFixed(2)}), H: ${avgH.toFixed(2)} (var: ${varianceH.toFixed(2)}), Nod: ${nodCount}, Shake: ${shakeCount}`)
              }
            }
          }
        }

        previousFrame = currentFrame
        animationFrameRef.current = requestAnimationFrame(detect)
      } catch (err) {
        console.error('PhotoTryoutResult: Error in detection loop:', err)
        animationFrameRef.current = requestAnimationFrame(detect)
      }
    }

    console.log('PhotoTryoutResult: Starting detection loop')
    detect()
  }, [gestureResult, handleGestureResult])

  const startGestureDetection = useCallback(async () => {
    try {
      console.log('PhotoTryoutResult: Starting gesture detection')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setTimeout(() => detectHeadMovement(), 500)
            })
          }
        }
      }
    } catch (error) {
      console.error('Error accessing camera for gesture detection:', error)
    }
  }, [detectHeadMovement])

  // Auto-close after 20 seconds when result is shown, with countdown
  // Then show gesture detection prompt
  useEffect(() => {
    if (showResult && currentCommand) {
      console.log('PhotoTryoutResult: Starting 20-second auto-close timer')
      setCountdown(20)
      
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      const gesturePromptTimer = setTimeout(() => {
        console.log('PhotoTryoutResult: 20 seconds elapsed, showing gesture prompt')
        setShowGesturePrompt(true)
        setGestureCountdown(10)
        startGestureDetection()
      }, 20000) // 20 seconds

      return () => {
        clearInterval(countdownInterval)
        clearTimeout(gesturePromptTimer)
      }
    }
  }, [showResult, currentCommand, startGestureDetection])

  // Gesture detection countdown and timeout
  useEffect(() => {
    if (showGesturePrompt && gestureResult === 'pending') {
      const gestureInterval = setInterval(() => {
        setGestureCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(gestureInterval)
            // Timeout - default to no
            handleGestureResult('no')
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => {
        clearInterval(gestureInterval)
      }
    }
  }, [showGesturePrompt, gestureResult, handleGestureResult])

  if (!showResult || !currentCommand || !currentCommand.result_image_url) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="relative max-w-4xl w-full mx-4">
        {!showGesturePrompt ? (
          <>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300 z-10"
            >
              ×
            </button>
            <div className="bg-white rounded-lg p-6">
              {/* Heading */}
              <h2 className="text-3xl font-bold text-black mb-6 text-center">
                {heading}
              </h2>
              
              {/* Image */}
              <div className="relative mb-4">
                <img
                  src={currentCommand.result_image_url}
                  alt="Tryout Result"
                  className="w-full rounded-lg"
                />
              </div>
              
              {/* Countdown timer - cleanly displayed below the image */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <span className="text-gray-600 text-sm">Auto-closing in</span>
                  <div className="bg-gray-100 px-3 py-1 rounded-full">
                    <span className="text-gray-800 font-bold text-lg tabular-nums">
                      {countdown}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
            {/* Gesture Detection Prompt */}
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-black mb-2">
                Will you be getting this?
              </h2>
              <p className="text-gray-600 text-lg mb-4">
                {gestureResult === 'pending' 
                  ? 'Nod your head for yes, shake for no'
                  : gestureResult === 'yes'
                  ? '✓ Added to your closet!'
                  : 'Noted - not adding to closet'}
              </p>
              
              {/* Countdown */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-gray-600 text-sm">Time remaining:</span>
                <div className="bg-gray-100 px-3 py-1 rounded-full">
                  <span className="text-gray-800 font-bold text-lg tabular-nums">
                    {gestureCountdown}s
                  </span>
                </div>
              </div>
            </div>

            {/* Video feed for gesture detection */}
            {gestureResult === 'pending' && (
              <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '4/3' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                  style={{ display: 'none' }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white/50 rounded-full w-48 h-48"></div>
                </div>
              </div>
            )}

            {/* Status indicator */}
            {gestureResult === 'pending' && (
              <>
                <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Detecting gesture...</span>
                </div>
                
                {/* Manual buttons as fallback */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleGestureResult('yes')}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg text-lg font-bold transition-colors"
                  >
                    ✓ Yes, I&apos;ll get it
                  </button>
                  <button
                    onClick={() => handleGestureResult('no')}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-bold transition-colors"
                  >
                    ✗ No, skip it
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
