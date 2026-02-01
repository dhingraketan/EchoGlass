'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PhotoTryoutSubmitPage() {
  const searchParams = useSearchParams()
  const commandId = searchParams.get('commandId')
  const [clothingInput, setClothingInput] = useState('')
  const [clothingFile, setClothingFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [inputType, setInputType] = useState<'url' | 'file'>('url')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setClothingFile(file)
    } else {
      setError('Please select an image file')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commandId) return

    if (inputType === 'url' && !clothingInput.trim()) {
      setError('Please enter a clothing URL')
      return
    }

    if (inputType === 'file' && !clothingFile) {
      setError('Please select an image file')
      return
    }

    setSubmitting(true)
    setError('')
    const supabase = createClient()
    if (!supabase) {
      setError('Failed to connect to database')
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
          const errorData = await extractResponse.json()
          throw new Error(errorData.error || 'Failed to extract image from URL')
        }

        const { imageUrl } = await extractResponse.json()
        clothingImageUrl = imageUrl

        // Update command with URL and extracted image URL
        const { error: updateError } = await supabase
          .from('photo_tryout_commands')
          .update({
            clothing_url: clothingInput,
            clothing_image_url: clothingImageUrl,
            status: 'waiting_photo'
          })
          .eq('id', commandId)

        if (updateError) {
          throw new Error(`Failed to update command: ${updateError.message}`)
        }
      } else {
        // Convert file to base64 data URL
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64Data = reader.result as string
          
          const { error: updateError } = await supabase
            .from('photo_tryout_commands')
            .update({
              clothing_image_url: base64Data,
              status: 'waiting_photo'
            })
            .eq('id', commandId)

          if (updateError) {
            setError('Failed to submit image. Please try again.')
            console.error('Error updating command:', updateError)
          } else {
            setSuccess(true)
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.close()
              }
            }, 2000)
          }
          setSubmitting(false)
        }
        reader.onerror = () => {
          setError('Failed to read file')
          setSubmitting(false)
        }
        reader.readAsDataURL(clothingFile!)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.close()
        }
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.')
      console.error('Error submitting clothing:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-4 text-center">
          Submit Clothing for Photo Tryout
        </h1>
        
        {success ? (
          <div className="text-center">
            <p className="text-green-400 mb-4">✓ Submitted successfully!</p>
            <p className="text-gray-400 text-sm">This window will close automatically.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setInputType('url')}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  inputType === 'url' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => setInputType('file')}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  inputType === 'file' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                Photo
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {inputType === 'url' ? 'Clothing URL' : 'Clothing Photo'}
              </label>
              {inputType === 'url' ? (
                <input
                  type="text"
                  value={clothingInput}
                  onChange={(e) => setClothingInput(e.target.value)}
                  placeholder="https://example.com/clothing-post"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={submitting}
                  required
                />
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={submitting}
                  required
                />
              )}
            </div>
            
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            
            <button
              type="submit"
              disabled={submitting || (inputType === 'url' && !clothingInput.trim()) || (inputType === 'file' && !clothingFile)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
