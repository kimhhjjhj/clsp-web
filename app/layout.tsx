import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'QuickPlan — 공동주택 공기산정',
  description: '건설 생애주기 공정관리 플랫폼 (CLSP) — 공동주택 개략공기 산정 웹 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} h-full dark`}>
      <body className="h-full bg-background text-foreground antialiased font-sans">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
