import type { Metadata } from 'next'
import { Noto_Sans_KR, Geist } from 'next/font/google'
import './globals.css'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto',
})

export const metadata: Metadata = {
  title: 'QuickPlan — 공동주택 공기산정',
  description: '건설 생애주기 공정관리 플랫폼 (CLSP) — 공동주택 개략공기 산정 웹 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn("h-full", notoSansKR.variable, "font-sans", geist.variable)}>
      <body className="h-full bg-gray-950 text-gray-100 antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
