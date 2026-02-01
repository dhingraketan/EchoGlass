import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`)
    }

    const html = await response.text()

    // Try to extract image URLs from common e-commerce patterns
    // Look for og:image, product images, or img tags with clothing-related classes
    const imagePatterns = [
      /<meta\s+property="og:image"\s+content="([^"]+)"/i,
      /<meta\s+name="og:image"\s+content="([^"]+)"/i,
      /<img[^>]+class="[^"]*product[^"]*"[^>]+src="([^"]+)"/i,
      /<img[^>]+class="[^"]*clothing[^"]*"[^>]+src="([^"]+)"/i,
      /<img[^>]+data-src="([^"]+)"[^>]*class="[^"]*product/i,
      /<img[^>]+src="([^"]+)"[^>]*class="[^"]*product/i,
    ]

    let imageUrl: string | null = null

    for (const pattern of imagePatterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        imageUrl = match[1]
        // Handle relative URLs
        if (imageUrl.startsWith('//')) {
          imageUrl = `https:${imageUrl}`
        } else if (imageUrl.startsWith('/')) {
          const urlObj = new URL(url)
          imageUrl = `${urlObj.origin}${imageUrl}`
        }
        break
      }
    }

    // If no pattern matched, try to find the largest image on the page
    if (!imageUrl) {
      const imgTagPattern = /<img[^>]+src="([^"]+)"/gi
      const matches = Array.from(html.matchAll(imgTagPattern))
      
      // Filter out small images (likely icons, logos, etc.)
      const candidateImages = matches
        .map(m => m[1])
        .filter(img => {
          // Exclude common non-product images
          const excludePatterns = [
            /logo/i,
            /icon/i,
            /avatar/i,
            /thumbnail/i,
            /placeholder/i,
            /\.(svg|gif)$/i
          ]
          return !excludePatterns.some(pattern => pattern.test(img))
        })

      if (candidateImages.length > 0) {
        // Return the first candidate (you could enhance this to fetch and check image sizes)
        imageUrl = candidateImages[0]
        if (imageUrl.startsWith('//')) {
          imageUrl = `https:${imageUrl}`
        } else if (imageUrl.startsWith('/')) {
          const urlObj = new URL(url)
          imageUrl = `${urlObj.origin}${imageUrl}`
        }
      }
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Could not extract image from URL' },
        { status: 404 }
      )
    }

    return NextResponse.json({ imageUrl })
  } catch (error: any) {
    console.error('Error extracting image:', error)
    return NextResponse.json(
      { error: 'Failed to extract image', details: error.message },
      { status: 500 }
    )
  }
}
