import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Magen — Meme Token Intelligence',
  description: 'Autonomous multi-agent AI debate system for BNB Chain meme token analysis. Real-time cultural intelligence and manipulation detection.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}