'use client'

import { useState, useEffect } from 'react'

const getWeatherIcon = (condition: string): string => {
  const conditionLower = condition.toLowerCase()
  if (conditionLower.includes('clear')) return 'wi-day-sunny'
  if (conditionLower.includes('cloud')) return 'wi-cloudy'
  if (conditionLower.includes('rain')) return 'wi-rain'
  if (conditionLower.includes('drizzle')) return 'wi-sprinkle'
  if (conditionLower.includes('thunder')) return 'wi-thunderstorm'
  if (conditionLower.includes('snow')) return 'wi-snow'
  if (conditionLower.includes('mist') || conditionLower.includes('fog')) return 'wi-fog'
  return 'wi-day-sunny'
}

interface WeatherData {
  current: {
    temp: number
    condition: string
    icon: string
    feelsLike: number
    windSpeed: number
    windDirection: string
    sunset: string
    location: string
  }
  daily: Array<{
    day: string
    dayName: string
    high: number
    low: number
    condition: string
    icon: string
  }>
}

// Convert wind direction degrees to compass direction
const getWindDirection = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return directions[Math.round(degrees / 22.5) % 16]
}

export default function WeatherWidget() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locationName, setLocationName] = useState('Loading location...')


  useEffect(() => {
    const fetchWeather = async () => {
      const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY?.trim()

      if (!apiKey) {
        setError('Weather API key not configured')
        return
      }

      if (apiKey.length < 20) {
        setError('API key format appears invalid')
        return
      }

      // Get user's location
      if (!navigator.geolocation) {
        setError('Geolocation not supported')
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords

          try {
            // Get location name first
            let locName = 'Loading...'
            try {
              const geoResponse = await fetch(
                `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${apiKey}`
              )
              if (geoResponse.ok) {
                const geoData = await geoResponse.json()
                if (geoData && geoData[0]) {
                  // Use state/province code (like BC, ON) instead of full name or country
                  const stateCode = geoData[0].state_code || geoData[0].state || ''
                  // Extract just the code if state contains full name (e.g., "British Columbia" -> "BC")
                  const code = stateCode.length <= 3 ? stateCode : stateCode.split(' ').map((w: string) => w[0]).join('').toUpperCase()
                  locName = `${geoData[0].name}${code ? ', ' + code : ''}`
                  setLocationName(locName)
                }
              }
            } catch (geoErr) {
              console.warn('Failed to fetch location name:', geoErr)
            }

            // Try One Call API 3.0 first (has hourly and daily forecasts)
            let weatherData: WeatherData | null = null
            
            try {
              const oneCallUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`
              const oneCallResponse = await fetch(oneCallUrl)
              
              if (oneCallResponse.ok) {
                const data = await oneCallResponse.json()
                
                if (data.current) {
                  // Get wind direction
                  const windDir = data.current.wind_deg !== undefined 
                    ? getWindDirection(data.current.wind_deg)
                    : 'N'

                  // Get sunset time from today's daily forecast
                  const todaySunset = data.daily && data.daily[0] && data.daily[0].sunset
                    ? new Date(data.daily[0].sunset * 1000).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })
                    : 'N/A'

                  // Process daily forecast (next 5 days)
                  const daily = (data.daily || []).slice(0, 5).map((d: any, idx: number) => {
                    const date = new Date(d.dt * 1000)
                    let dayName = ''
                    if (idx === 0) {
                      dayName = 'Today'
                    } else if (idx === 1) {
                      dayName = 'Tomorrow'
                    } else {
                      dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
                    }
                    
                    return {
                      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                      dayName: dayName,
                      high: d.temp.max,
                      low: d.temp.min,
                      condition: d.weather[0]?.main || 'Clear',
                      icon: getWeatherIcon(d.weather[0]?.main || 'Clear')
                    }
                  })

                  weatherData = {
                    current: {
                      temp: data.current.temp,
                      condition: data.current.weather[0]?.main || 'Clear',
                      icon: getWeatherIcon(data.current.weather[0]?.main || 'Clear'),
                      feelsLike: data.current.feels_like || data.current.temp,
                      windSpeed: data.current.wind_speed || 0,
                      windDirection: windDir,
                      sunset: todaySunset,
                      location: locName
                    },
                    daily
                  }
                  
                  setWeatherData(weatherData)
                  setError(null)
                  return
                }
              }
            } catch (oneCallErr) {
              console.log('One Call API 3.0 failed, trying forecast API')
            }

            // Fallback: Use Forecast API (5-day/3-hour forecast)
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`
            const forecastResponse = await fetch(forecastUrl)

            if (!forecastResponse.ok) {
              throw new Error(`API error: ${forecastResponse.status}`)
            }

            const forecastData = await forecastResponse.json()
            
            if (!forecastData.list || !forecastData.list[0]) {
              throw new Error('Invalid forecast response')
            }

            // Get current weather
            const current = forecastData.list[0]
            const currentCondition = current.weather[0]?.main || 'Clear'
            const currentTemp = current.main.temp
            const currentFeelsLike = current.main.feels_like || currentTemp
            const currentWindSpeed = current.wind?.speed || 0
            const currentWindDeg = current.wind?.deg || 0
            const windDir = getWindDirection(currentWindDeg)
            
            // Get sunset time - calculate from current time (simplified, would need actual sunset data)
            const sunsetTime = '7:30 PM' // Placeholder - Forecast API doesn't provide sunset

            // Process daily forecast (group by day, get next 5 days)
            const dailyMap = new Map()
            forecastData.list.forEach((item: any, idx: number) => {
              const date = new Date(item.dt * 1000)
              const dayKey = date.toDateString()
              if (!dailyMap.has(dayKey) && dailyMap.size < 5) {
                let dayName = ''
                if (dailyMap.size === 0) {
                  dayName = 'Today'
                } else if (dailyMap.size === 1) {
                  dayName = 'Tomorrow'
                } else {
                  dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
                }
                
                dailyMap.set(dayKey, {
                  day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                  dayName: dayName,
                  high: item.main.temp_max,
                  low: item.main.temp_min,
                  condition: item.weather[0]?.main || 'Clear',
                  icon: getWeatherIcon(item.weather[0]?.main || 'Clear')
                })
              } else if (dailyMap.has(dayKey)) {
                const existing = dailyMap.get(dayKey)
                existing.high = Math.max(existing.high, item.main.temp_max)
                existing.low = Math.min(existing.low, item.main.temp_min)
              }
            })

            const daily = Array.from(dailyMap.values()).slice(0, 5)

            weatherData = {
              current: {
                temp: currentTemp,
                condition: currentCondition,
                icon: getWeatherIcon(currentCondition),
                feelsLike: currentFeelsLike,
                windSpeed: currentWindSpeed,
                windDirection: windDir,
                sunset: sunsetTime,
                location: locName || forecastData.city?.name || 'Unknown'
              },
              daily
            }

            setWeatherData(weatherData)
            setError(null)
          } catch (err: any) {
            console.error('Failed to fetch weather:', err)
            setError(err.message || 'Failed to load weather')
          }
        },
        (err) => {
          console.error('Geolocation error:', err)
          setError('Location access denied')
        }
      )
    }

    fetchWeather()
    // Update every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  if (error) {
    return (
      <div className="text-white text-right w-full">
        <div className="text-sm font-light text-white/70">{error}</div>
      </div>
    )
  }

  if (!weatherData) {
    return (
      <div className="text-white text-right w-full">
        <div className="text-sm font-light">Loading weather...</div>
      </div>
    )
  }

  return (
    <div className="text-white text-right w-full">
      {/* First row: Wind and Sunset - regular text size */}
      <div className="flex items-center justify-end gap-4 mb-4 text-base font-light">
        <div className="flex items-center gap-2">
          <i className="wi wi-strong-wind text-white"></i>
          <span>{Math.round(weatherData.current.windSpeed)}</span>
          <span className="bg-white text-black px-2 py-0.5 rounded text-xs font-medium">
            {weatherData.current.windDirection}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <i className="wi wi-sunset text-white"></i>
          <span>{weatherData.current.sunset}</span>
        </div>
      </div>

      {/* Second row: Big icon and temp - big and bold */}
      <div className="flex items-center justify-end gap-3 mb-2">
        <i className={`wi ${weatherData.current.icon} text-6xl text-white`}></i>
        <span className="text-5xl font-bold">{weatherData.current.temp.toFixed(1)}</span>
      </div>

      {/* Third row: Feels Like - regular font */}
      <div className="text-base font-light mb-4">
        Feels Like {weatherData.current.feelsLike.toFixed(1)}
      </div>

      {/* Space */}
      <div className="mb-3"></div>

      {/* Weather Forecast header */}
      <div className="text-base font-light mb-2">
        Weather Forecast <span className="font-bold">{weatherData.current.location}</span>
      </div>

      {/* Horizontal separator */}
      <div className="border-t border-white/30 mb-3 w-3/4 ml-auto"></div>

      {/* 5-day forecast */}
      <div className="space-y-2">
        {weatherData.daily.map((day, idx) => {
          const opacity = 1 - (idx * 0.15) // Fade from 100% to 40% over 5 days
          return (
            <div key={idx} className="flex items-center justify-end gap-3 text-base font-light" style={{ opacity }}>
              <span className="w-20 text-left pr-8">{day.dayName}</span>
              <span className="w-8 text-center">
                <i className={`wi ${day.icon} text-2xl text-white`}></i>
              </span>
              <span className="w-12 text-right font-bold">{day.high.toFixed(1)}</span>
              <span className="w-12 text-right">{day.low.toFixed(1)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
