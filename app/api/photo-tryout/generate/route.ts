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
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Fetch images and convert to base64
    const [userPhotoResponse, clothingImageResponse] = await Promise.all([
      fetch(userPhotoUrl),
      fetch(clothingImageUrl)
    ])

    if (!userPhotoResponse.ok || !clothingImageResponse.ok) {
      throw new Error('Failed to fetch images')
    }

    const [userPhotoBuffer, clothingImageBuffer] = await Promise.all([
      userPhotoResponse.arrayBuffer(),
      clothingImageResponse.arrayBuffer()
    ])

    const userPhotoBase64 = Buffer.from(userPhotoBuffer).toString('base64')
    const clothingImageBase64 = Buffer.from(clothingImageBuffer).toString('base64')

    // Get MIME types
    const userPhotoMimeType = userPhotoResponse.headers.get('content-type') || 'image/jpeg'
    const clothingImageMimeType = clothingImageResponse.headers.get('content-type') || 'image/jpeg'

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

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(geminiRequest)
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      throw new Error(`Gemini API error: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()

    // Extract the generated image from the response
    // Gemini image generation returns images in inline_data format
    const generatedImagePart = geminiData.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.inline_data?.mime_type?.startsWith('image/')
    )

    if (!generatedImagePart?.inline_data?.data) {
      console.log('Gemini response structure:', JSON.stringify(geminiData, null, 2))
      return NextResponse.json(
        { error: 'No image generated in response', response: geminiData },
        { status: 500 }
      )
    }

    return NextResponse.json({
      imageData: generatedImagePart.inline_data.data,
      mimeType: generatedImagePart.inline_data.mime_type || 'image/png'
    })
  } catch (error: any) {
    console.error('Error generating image:', error)
    return NextResponse.json(
      { error: 'Failed to generate image', details: error.message },
      { status: 500 }
    )
  }
}
