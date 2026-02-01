'use client'

import { useState, useEffect } from 'react'

interface StockData {
  symbol: string
  price: number
  change: number // positive for up, negative for down
}

// Fallback mock data
const mockStocks: StockData[] = [
  { symbol: 'VOO', price: 485.23, change: 2.45 },
  { symbol: 'BTC', price: 43250.89, change: -1250.50 },
  { symbol: 'ETH', price: 2650.34, change: 45.67 },
  { symbol: 'AAPL', price: 185.67, change: -2.34 },
  { symbol: 'GOOGL', price: 142.89, change: 1.23 },
  { symbol: 'MSFT', price: 378.45, change: 5.67 },
  { symbol: 'TSLA', price: 245.12, change: -8.90 },
  { symbol: 'NVDA', price: 485.67, change: 12.34 },
  { symbol: 'AMZN', price: 152.34, change: -1.56 },
  { symbol: 'SPY', price: 482.45, change: 3.21 },
]

export default function StockTicker() {
  const [stocks, setStocks] = useState<StockData[]>(mockStocks)

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const response = await fetch('/api/stocks')
        if (response.ok) {
          const data = await response.json()
          if (data.stocks && data.stocks.length > 0) {
            setStocks(data.stocks)
          }
        }
      } catch (error) {
        console.error('Failed to fetch stock data:', error)
        // Keep using mock data on error
      }
    }

    fetchStockData()
    // Refresh every 30 minutes
    const interval = setInterval(fetchStockData, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const renderStockItem = (stock: StockData, showSeparator: boolean) => (
    <div key={`${stock.symbol}-${Math.random()}`} className="flex items-center gap-2 text-sm font-light text-white flex-shrink-0">
      <span className="font-bold">{stock.symbol}</span>
      <span>{stock.change >= 0 ? '↑' : '↓'}</span>
      <span>${stock.price.toFixed(2)}</span>
      {showSeparator && <span className="text-white/50 mx-2">|</span>}
    </div>
  )

  return (
    <div className="w-full overflow-hidden relative h-8">
      <div className="flex items-center gap-0 animate-scroll whitespace-nowrap">
        {/* Duplicate content multiple times for seamless infinite scroll */}
        {[...stocks, ...stocks, ...stocks].map((stock, idx, arr) => 
          renderStockItem(stock, idx < arr.length - 1)
        )}
      </div>
    </div>
  )
}
