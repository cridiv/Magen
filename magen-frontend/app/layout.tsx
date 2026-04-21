import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Magen — AI Meme Intelligence',
  description: 'Autonomous multi-agent debate system for BNB Chain meme tokens',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}