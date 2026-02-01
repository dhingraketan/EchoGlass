'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [detectionStatus, setDetectionStatus] = useState<string>('Initializing...')
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
  const showCommand = (command: PhotoTryoutCommand) => {
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
  }

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
  }, [])

  const handleClose = () => {
    setShowResult(false)
    setCurrentCommand(null)
    showingResultRef.current = false
    // Note: We keep the command ID in shownCommandIdsRef so we don't show it again
  }

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
  }, [showResult, currentCommand])

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
  }, [showGesturePrompt, gestureResult])

  const startGestureDetection = async () => {
    try {
      setDetectionStatus('Accessing camera...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setDetectionStatus('Camera ready. Detecting gestures...')
        detectHeadMovement()
      }
    } catch (error) {
      console.error('Error accessing camera for gesture detection:', error)
      setDetectionStatus('Camera access failed. Will timeout after 10 seconds.')
      // If camera fails, default to no after timeout
    }
  }

  const detectHeadMovement = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Use Face Detection API if available, otherwise fallback to motion detection
    // @ts-ignore
    if (window.FaceDetector) {
      useFaceDetectionAPI()
    } else {
      useMotionDetection()
    }

    function useFaceDetectionAPI() {
      setDetectionStatus('Using Face Detection API')
      // @ts-ignore
      const faceDetector = new window.FaceDetector({
        fastMode: true,
        maxDetections: 1
      })

      let headPositions: { x: number; y: number }[] = []
      let nodCount = 0
      let shakeCount = 0
      let noFaceCount = 0

      const detect = async () => {
        if (!videoRef.current || gestureResult !== 'pending') {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
          }
          return
        }

        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          // @ts-ignore
          const faces = await faceDetector.detect(video)

          if (faces && faces.length > 0) {
            noFaceCount = 0
            const face = faces[0]
            const boundingBox = face.boundingBox
            const headX = boundingBox.x + boundingBox.width / 2
            const headY = boundingBox.y + boundingBox.height / 2

            headPositions.push({ x: headX, y: headY })
            if (headPositions.length > 30) {
              headPositions.shift()
            }

            if (headPositions.length >= 15) {
              // Analyze vertical movement (nodding)
              const recentY = headPositions.slice(-15).map(p => p.y)
              const minY = Math.min(...recentY)
              const maxY = Math.max(...recentY)
              const verticalRange = maxY - minY

              if (verticalRange > 25) {
                nodCount++
                shakeCount = Math.max(0, shakeCount - 1)
                setDetectionStatus(`Nodding detected (${nodCount}/5)`)
                console.log('Nodding detected:', nodCount, 'range:', verticalRange.toFixed(1))
                if (nodCount >= 5) {
                  handleGestureResult('yes')
                  return
                }
              } else {
                nodCount = Math.max(0, nodCount - 1)
              }

              // Analyze horizontal movement (shaking)
              const recentX = headPositions.slice(-15).map(p => p.x)
              const minX = Math.min(...recentX)
              const maxX = Math.max(...recentX)
              const horizontalRange = maxX - minX

              if (horizontalRange > 25) {
                shakeCount++
                nodCount = Math.max(0, nodCount - 1)
                setDetectionStatus(`Shaking detected (${shakeCount}/5)`)
                console.log('Shaking detected:', shakeCount, 'range:', horizontalRange.toFixed(1))
                if (shakeCount >= 5) {
                  handleGestureResult('no')
                  return
                }
              } else {
                shakeCount = Math.max(0, shakeCount - 1)
              }
            } else {
              setDetectionStatus(`Tracking face... (${headPositions.length}/15)`)
            }
          } else {
            noFaceCount++
            if (noFaceCount > 10) {
              setDetectionStatus('Face not detected. Please look at the camera.')
            }
          }
        } catch (err) {
          console.error('Face detection error:', err)
          setDetectionStatus('Detection error. Using motion detection...')
          useMotionDetection()
          return
        }

        animationFrameRef.current = requestAnimationFrame(detect)
      }

      detect()
    }

    function useMotionDetection() {
      setDetectionStatus('Using motion detection')
      let previousFrame: ImageData | null = null
      let centerOfMassHistory: { x: number; y: number }[] = []
      let nodCount = 0
      let shakeCount = 0
      let frameCount = 0

      const detect = () => {
        if (!videoRef.current || !canvasRef.current || gestureResult !== 'pending') {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
          }
          return
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height)

        if (previousFrame) {
          // Calculate center of mass of motion
          let totalMotionX = 0
          let totalMotionY = 0
          let totalMotion = 0

          // Focus on center region
          const centerX = Math.floor(canvas.width / 2)
          const centerY = Math.floor(canvas.height / 2)
          const regionSize = 200

          for (let y = centerY - regionSize; y < centerY + regionSize; y += 10) {
            for (let x = centerX - regionSize; x < centerX + regionSize; x += 10) {
              if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                const idx = (y * canvas.width + x) * 4
                
                const currentBrightness = (
                  currentFrame.data[idx] + 
                  currentFrame.data[idx + 1] + 
                  currentFrame.data[idx + 2]
                ) / 3
                
                const prevBrightness = (
                  previousFrame.data[idx] + 
                  previousFrame.data[idx + 1] + 
                  previousFrame.data[idx + 2]
                ) / 3
                
                const diff = Math.abs(currentBrightness - prevBrightness)
                
                if (diff > 8) { // Lower motion threshold
                  totalMotionX += x * diff
                  totalMotionY += y * diff
                  totalMotion += diff
                }
              }
            }
          }

          if (totalMotion > 0) {
            const centerOfMassX = totalMotionX / totalMotion
            const centerOfMassY = totalMotionY / totalMotion

            centerOfMassHistory.push({ x: centerOfMassX, y: centerOfMassY })
            if (centerOfMassHistory.length > 20) {
              centerOfMassHistory.shift()
            }

            frameCount++
            if (frameCount % 3 === 0 && centerOfMassHistory.length >= 10) {
              // Analyze vertical movement (nodding)
              const recentY = centerOfMassHistory.slice(-10).map(p => p.y)
              const minY = Math.min(...recentY)
              const maxY = Math.max(...recentY)
              const verticalRange = maxY - minY

              if (verticalRange > 35) {
                nodCount++
                shakeCount = Math.max(0, shakeCount - 1)
                setDetectionStatus(`Nodding detected (${nodCount}/4) - Range: ${verticalRange.toFixed(1)}`)
                console.log('Nodding detected:', nodCount, 'vertical range:', verticalRange.toFixed(1))
                if (nodCount >= 4) {
                  handleGestureResult('yes')
                  return
                }
              } else {
                nodCount = Math.max(0, nodCount - 1)
              }

              // Analyze horizontal movement (shaking)
              const recentX = centerOfMassHistory.slice(-10).map(p => p.x)
              const minX = Math.min(...recentX)
              const maxX = Math.max(...recentX)
              const horizontalRange = maxX - minX

              if (horizontalRange > 35) {
                shakeCount++
                nodCount = Math.max(0, nodCount - 1)
                setDetectionStatus(`Shaking detected (${shakeCount}/4) - Range: ${horizontalRange.toFixed(1)}`)
                console.log('Shaking detected:', shakeCount, 'horizontal range:', horizontalRange.toFixed(1))
                if (shakeCount >= 4) {
                  handleGestureResult('no')
                  return
                }
              } else {
                shakeCount = Math.max(0, shakeCount - 1)
              }

              if (nodCount === 0 && shakeCount === 0) {
                setDetectionStatus('Move your head - nod for yes, shake for no')
              }
            }
          } else {
            setDetectionStatus('Waiting for movement...')
          }
        }

        previousFrame = currentFrame
        animationFrameRef.current = requestAnimationFrame(detect)
      }

      detect()
    }
  }

  const handleGestureResult = async (result: 'yes' | 'no') => {
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
  }

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
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white/50 rounded-full w-48 h-48"></div>
                </div>
              </div>
            )}

            {/* Status indicator */}
            {gestureResult === 'pending' && (
              <div className="flex flex-col items-center gap-2 text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">{detectionStatus}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
