import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Store Locator Admin",
  description: "Store Locator Admin Panel admin panel",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-theme-preset="listings">
      <body>{children}</body>
    </html>
  )
}
