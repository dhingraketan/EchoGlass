import { NextRequest, NextResponse } from 'next/server'

const GEMINI_PROMPT = `Use Image 1 as the primary identity reference and Image 2 as the clothing reference.

Generate a photorealistic image of the person from Image 1 wearing the exact dress shown in Image 2.

Face and identity lock (highest priority):
The face must be 100% identical to Image 1. Preserve facial features, bone structure, face shape, jawline, eyes, nose, lips, skin tone, and hairstyle exactly as in Image 1. Do not alter identity in any way. Maintain realistic skin texture with natural pores and fine details. Avoid any plastic, AI-smoothed, beautified, or altered look. No distortion, reshaping, or facial hallucination. The person must be instantly recognizable as the same individual from Image 1.

Clothing accuracy:
Apply the dress from Image 2 exactly as shown. Preserve fabric type, color, patterns, cuts, seams, fit, neckline, sleeves, length, folds, and textures. The dress should sit naturally on the body with realistic draping and shadows. Ensure the outfit is clearly visible and properly framed, not cropped or obscured.

Body and proportions:
Keep natural human proportions. No exaggerated curves or body reshaping. The body should look realistic and anatomically correct for the person in Image 1.

Lighting and realism:
Use realistic lighting consistent across face and clothing. Match shadows, highlights, and color temperature so the dress blends naturally with the person. No mismatched lighting between face and outfit.

Image quality:
Ultra-realistic, high resolution, sharp focus, natural depth of field. Professional photography look. No blur, no artifacts, no painterly or cartoon style.

Restrictions:
Do not change hairstyle, facial expression, age, gender, ethnicity, or skin tone. Do not modify the dress design. Do not add accessories unless they already exist in Image 1 or Image 2.`

export async function POST(request: NextRequest) {
  try {
    const { userPhotoUrl, clothingImageUrl } = await request.json()

    if (!userPhotoUrl || !clothingImageUrl) {
      return NextResponse.json(
        { error: 'Both userPhotoUrl and clothingImageUrl are required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in environment variables')
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('GEMINI')))
      return NextResponse.json(
        { error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your .env.local file.' },
        { status: 500 }
      )
    }

    // Helper function to extract base64 from data URL or fetch from regular URL
    const getImageBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
      // Check if it's a data URL (base64 encoded)
      if (url.startsWith('data:')) {
        const matches = url.match(/^data:([^;]+);base64,(.+)$/)
        if (matches) {
          return {
            base64: matches[2],
            mimeType: matches[1] || 'image/jpeg'
          }
        }
        throw new Error('Invalid data URL format')
      }

      // Regular URL - fetch it
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${response.status}`)
      }
      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = response.headers.get('content-type') || 'image/jpeg'
      return { base64, mimeType }
    }

    // Get images as base64
    const [userPhotoData, clothingImageData] = await Promise.all([
      getImageBase64(userPhotoUrl),
      getImageBase64(clothingImageUrl)
    ])

    const userPhotoBase64 = userPhotoData.base64
    const clothingImageBase64 = clothingImageData.base64
    const userPhotoMimeType = userPhotoData.mimeType
    const clothingImageMimeType = clothingImageData.mimeType

    // Call Gemini API for image generation
    // Use gemini-2.5-flash-image or gemini-3-pro-image-preview for image generation
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`
    
    const geminiRequest = {
      contents: [{
        parts: [
          {
            text: `${GEMINI_PROMPT}\n\nImage 1 is the person photo, Image 2 is the clothing photo.`
          },
          {
            inline_data: {
              mime_type: userPhotoMimeType,
              data: userPhotoBase64
            }
          },
          {
            inline_data: {
              mime_type: clothingImageMimeType,
              data: clothingImageBase64
            }
          }
        ]
      }],
      generationConfig: {
        responseModalities: ["IMAGE"]
      }
    }

    console.log('Calling Gemini API with model: gemini-2.5-flash-image')
    console.log('Request payload size:', JSON.stringify(geminiRequest).length, 'bytes')
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiRequest)
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error status:', geminiResponse.status)
      console.error('Gemini API error response:', errorText)
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`)
    }

    const geminiData = await geminiResponse.json()
    console.log('Gemini API response received, candidates:', geminiData.candidates?.length || 0)
    
    // Log the full response structure (without huge base64 data) for debugging
    console.log('Full Gemini response structure:', JSON.stringify({
      ...geminiData,
      candidates: geminiData.candidates?.map((c: any) => ({
        ...c,
        content: c.content ? {
          ...c.content,
          parts: c.content.parts?.map((p: any) => ({
            ...p,
            inline_data: p.inline_data ? {
              mime_type: p.inline_data.mime_type,
              data_length: p.inline_data.data?.length || 0,
              data_preview: p.inline_data.data?.substring(0, 50) || 'no data'
            } : null,
            text: p.text ? p.text.substring(0, 200) : null
          }))
        } : null
      }))
    }, null, 2))
    
    // Log the full candidate structure (without huge base64 data)
    if (geminiData.candidates?.[0]) {
      const candidate = geminiData.candidates[0]
      console.log('Candidate keys:', Object.keys(candidate))
      console.log('Candidate finishReason:', candidate.finishReason)
      if (candidate.content) {
        console.log('Content keys:', Object.keys(candidate.content))
        console.log('Content role:', candidate.content.role)
      }
    }

    // Extract the generated image from the response
    // Gemini image generation returns images in inline_data format
    // Structure: candidates[0].content.parts[0].inline_data.data
    const candidate = geminiData.candidates?.[0]
    
    if (!candidate) {
      console.error('No candidate in response')
      return NextResponse.json(
        { error: 'No candidate in Gemini response' },
        { status: 500 }
      )
    }

    const content = candidate.content
    if (!content) {
      console.error('No content in candidate')
      console.error('Candidate structure:', JSON.stringify(candidate, null, 2))
      return NextResponse.json(
        { error: 'Invalid response structure - no content' },
        { status: 500 }
      )
    }

    const parts = content.parts || []
    console.log('Found', parts.length, 'parts in response')
    console.log('Candidate finishReason:', candidate.finishReason)
    
    // Check if there's a text response explaining why image wasn't generated
    const textParts = parts.filter((p: any) => p.text)
    if (textParts.length > 0) {
      console.log('Text parts found:', textParts.map((p: any) => p.text))
    }
    
    // Log the actual structure of the first part to debug
    if (parts.length > 0) {
      const firstPart = parts[0]
      console.log('First part keys:', Object.keys(firstPart))
      console.log('First part structure (without data):', JSON.stringify({
        ...firstPart,
        inline_data: firstPart.inline_data ? {
          mime_type: firstPart.inline_data.mime_type,
          data_length: firstPart.inline_data.data?.length || 0,
          data_preview: firstPart.inline_data.data?.substring(0, 50) || 'no data'
        } : null
      }, null, 2))
    }
    
    // Log parts structure (without the huge base64 data)
    parts.forEach((part: any, idx: number) => {
      if (part.inline_data) {
        console.log(`Part ${idx}: has inline_data, mime_type: ${part.inline_data.mime_type}, data length: ${part.inline_data.data?.length || 0}`)
        console.log(`Part ${idx}: inline_data keys:`, Object.keys(part.inline_data))
        console.log(`Part ${idx}: inline_data structure:`, JSON.stringify({
          mime_type: part.inline_data.mime_type,
          has_data: !!part.inline_data.data,
          data_type: typeof part.inline_data.data,
          data_length: part.inline_data.data?.length || 0
        }, null, 2))
      } else if (part.text) {
        console.log(`Part ${idx}: has text:`, part.text.substring(0, 200))
      } else {
        console.log(`Part ${idx}: type: unknown, keys:`, Object.keys(part))
        console.log(`Part ${idx}: full part structure:`, JSON.stringify(part, null, 2))
      }
    })
    
    // Try direct access first (most common structure)
    // Handle both snake_case (REST API) and camelCase (SDK) formats
    let imageData: string | undefined
    let mimeType: string | undefined
    
    // Check first part directly
    if (parts.length > 0) {
      const firstPart = parts[0]
      // Try snake_case format (REST API)
      if (firstPart.inline_data?.data) {
        imageData = firstPart.inline_data.data
        mimeType = firstPart.inline_data.mime_type
        console.log('Found image in first part via direct access (snake_case)')
      }
      // Try camelCase format (SDK format, just in case)
      else if (firstPart.inlineData?.data) {
        imageData = firstPart.inlineData.data
        mimeType = firstPart.inlineData.mimeType
        console.log('Found image in first part via direct access (camelCase)')
      }
    }
    
    // If not found in first part, search all parts
    if (!imageData) {
      for (const part of parts) {
        // Try snake_case format
        if (part.inline_data?.data && part.inline_data.mime_type?.startsWith('image/')) {
          imageData = part.inline_data.data
          mimeType = part.inline_data.mime_type
          console.log('Found image via search (snake_case)')
          break
        }
        // Try camelCase format
        else if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/')) {
          imageData = part.inlineData.data
          mimeType = part.inlineData.mimeType
          console.log('Found image via search (camelCase)')
          break
        }
      }
      
      // Last resort: find any part with inline_data/inlineData
      if (!imageData) {
        for (const part of parts) {
          if (part.inline_data?.data) {
            imageData = part.inline_data.data
            mimeType = part.inline_data.mime_type
            console.log('Found image via fallback search (snake_case)')
            break
          } else if (part.inlineData?.data) {
            imageData = part.inlineData.data
            mimeType = part.inlineData.mimeType
            console.log('Found image via fallback search (camelCase)')
            break
          }
        }
      }
    }

    if (!imageData) {
      console.error('No image data found in any part')
      console.error('Parts summary:', parts.map((p: any, i: number) => ({
        index: i,
        hasInlineData: !!p.inline_data || !!p.inlineData,
        mimeType: p.inline_data?.mime_type || p.inlineData?.mimeType,
        hasData: !!(p.inline_data?.data || p.inlineData?.data),
        dataLength: (p.inline_data?.data || p.inlineData?.data)?.length || 0,
        hasText: !!p.text,
        textPreview: p.text?.substring(0, 500),
        allKeys: Object.keys(p)
      })))
      
      // Check if there's a text explanation
      const textResponse = parts.find((p: any) => p.text)?.text
      if (textResponse) {
        console.error('Gemini returned text instead of image. Full text:', textResponse)
        return NextResponse.json(
          { 
            error: 'Gemini returned text instead of image', 
            text: textResponse, 
            finishReason: candidate.finishReason,
            partsCount: parts.length,
            partsSummary: parts.map((p: any) => ({
              hasText: !!p.text,
              hasInlineData: !!p.inline_data || !!p.inlineData,
              keys: Object.keys(p)
            }))
          },
          { status: 500 }
        )
      }
      
      // Log the full response for debugging
      console.error('Full response structure (for debugging):', JSON.stringify({
        candidates: geminiData.candidates?.length || 0,
        firstCandidate: {
          finishReason: candidate.finishReason,
          content: {
            role: candidate.content?.role,
            partsCount: candidate.content?.parts?.length || 0,
            parts: candidate.content?.parts?.map((p: any, i: number) => ({
              index: i,
              keys: Object.keys(p),
              hasText: !!p.text,
              hasInlineData: !!p.inline_data || !!p.inlineData,
              textPreview: p.text?.substring(0, 100)
            }))
          }
        }
      }, null, 2))
      
      return NextResponse.json(
        { 
          error: 'No image data found in response', 
          partsCount: parts.length, 
          finishReason: candidate.finishReason,
          partsSummary: parts.map((p: any, i: number) => ({
            index: i,
            keys: Object.keys(p),
            hasText: !!p.text,
            hasInlineData: !!p.inline_data || !!p.inlineData,
            textPreview: p.text?.substring(0, 200)
          }))
        },
        { status: 500 }
      )
    }
    
    console.log('Successfully extracted image, mimeType:', mimeType, 'data length:', imageData?.length || 0)

    return NextResponse.json({
      imageData: imageData,
      mimeType: mimeType || 'image/png'
    })
  } catch (error: any) {
    console.error('Error generating image:', error)
    return NextResponse.json(
      { error: 'Failed to generate image', details: error.message },
      { status: 500 }
    )
  }
}
