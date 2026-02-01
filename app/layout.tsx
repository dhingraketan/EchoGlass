import type { Metadata } from 'next'
import './globals.css'
import '/public/weather-icons.min.css'

export const metadata: Metadata = {
  title: 'EchoGlass Smart Mirror',
  description: 'Smart Mirror Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full w-full">
      <body className="h-full w-full">{children}</body>
    </html>
  )
}
