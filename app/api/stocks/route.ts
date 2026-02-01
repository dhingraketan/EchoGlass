import { NextResponse } from 'next/server'

const STOCK_SYMBOLS = ['VOO', 'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'SPY']
const CRYPTO_SYMBOLS = ['BTC', 'ETH']

export async function GET() {
  const apiKey = process.env.STOCKS_API_KEY

  if (!apiKey) {
    console.error('STOCKS_API_KEY not configured')
    return NextResponse.json(
      { error: 'STOCKS_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const allSymbols = [...STOCK_SYMBOLS, ...CRYPTO_SYMBOLS]
    const stockData = []

    // Fetch stock data for each symbol
    for (const symbol of allSymbols) {
      try {
        // Determine if it's crypto or stock
        const isCrypto = CRYPTO_SYMBOLS.includes(symbol)
        // Try different endpoint formats - check Massive API docs for correct format
        // Option 1: /v1/stocks/{symbol} with query param
        const endpoint = isCrypto 
          ? `https://api.massive.com/v1/crypto/${symbol}`
          : `https://api.massive.com/v1/stocks/${symbol}`

        // Try with apiKey as query parameter first
        const url = `${endpoint}?apiKey=${apiKey}`
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          
          // Massive API returns: { status, count, results: [...], request_id }
          // Extract price and change from the results array
          let price = 0
          let change = 0
          
          if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            const result = data.results[0]
            // Try common field names for price and change
            price = result.price || result.last_price || result.close || result.current_price || result.quote?.price || 0
            change = result.change || result.change_percent || result.price_change || result.quote?.change || 0
          } else if (data.price || data.close) {
            // Direct fields if not in results array
            price = data.price || data.close || data.current_price || 0
            change = data.change || data.change_percent || data.price_change || 0
          }
          
          // Convert to numbers if strings
          price = typeof price === 'number' ? price : parseFloat(String(price)) || 0
          change = typeof change === 'number' ? change : parseFloat(String(change)) || 0
          
          if (price > 0) {
            stockData.push({
              symbol,
              price,
              change
            })
          } else {
            console.warn(`No valid price found for ${symbol}`, JSON.stringify(data, null, 2))
          }
        } else {
          const errorText = await response.text()
          console.error(`Failed to fetch ${symbol}:`, response.status, response.statusText, errorText)
        }
      } catch (err: any) {
        console.error(`Error fetching ${symbol}:`, err.message)
        // Continue with other symbols even if one fails
      }
    }

    // Return empty array if no data, but don't error
    return NextResponse.json({ stocks: stockData })
  } catch (error: any) {
    console.error('Error fetching stock data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: error.message },
      { status: 500 }
    )
  }
}
