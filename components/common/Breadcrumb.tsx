'use client'

// ═══════════════════════════════════════════════════════════
// 글로벌 브레드크럼
// - URL 경로를 자동 분석해서 "대시보드 > 프로젝트 > 상봉동 > 1단계" 표시
// - 프로젝트·일보 ID 구간은 /api에서 이름 자동 조회
// - 대시보드 레이아웃 상단에 고정 표시
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, ChevronRight } from 'lucide-react'

interface Crumb {
  label: string
  href?: string
}

const STAGE_LABELS: Record<string, string> = {
  '1': '1단계 · 개략공기',
  '2': '2단계 · 프리콘',
  '3': '3단계 · 시공관리',
  '4': '4단계 · 분석',
}

const STATIC_ROUTES: Record<string, string> = {
  'projects': '프로젝트',
  'new': '신규',
  'edit': '수정',
  'daily-reports': '일보',
  'admin': '관리자',
  'productivity': '생산성 승인',
  'import': '엑셀 임포트',
  'prototype': '프로토타입',
}

// 메모이제이션 캐시 (같은 id는 한 번만 fetch)
const nameCache = new Map<string, string>()

export default function Breadcrumb() {
  const pathname = usePathname()
  const [crumbs, setCrumbs] = useState<Crumb[]>([])

  useEffect(() => {
    if (!pathname || pathname === '/') { setCrumbs([]); return }

    const segments = pathname.split('/').filter(Boolean)
    const base: Crumb[] = [{ label: '대시보드', href: '/' }]
    let currentPath = ''
    const pending: { idx: number; type: 'project' | 'report'; id: string }[] = []

    segments.forEach((seg, i) => {
      currentPath += `/${seg}`
      const prev = segments[i - 1]

      // 프로젝트 ID 구간
      if (prev === 'projects' && seg !== 'new' && !seg.startsWith('[')) {
        const cached = nameCache.get(`proj:${seg}`)
        base.push({ label: cached ?? '프로젝트…', href: `/projects/${seg}` })
        if (!cached) pending.push({ idx: base.length - 1, type: 'project', id: seg })
        return
      }

      // 일보 ID 구간 (daily-reports/<id>)
      if (prev === 'daily-reports' && seg !== 'new') {
        const cached = nameCache.get(`report:${seg}`)
        base.push({ label: cached ?? '일보…' })
        if (!cached) pending.push({ idx: base.length - 1, type: 'report', id: seg })
        return
      }

      // stage 구간 (stage/1)
      if (prev === 'stage') {
        base.push({ label: STAGE_LABELS[seg] ?? `${seg}단계` })
        return
      }

      // 정적 라벨
      if (STATIC_ROUTES[seg]) {
        base.push({ label: STATIC_ROUTES[seg], href: currentPath })
        return
      }

      // 그 외 (stage 세그먼트 자체 등) 스킵
      if (seg === 'stage') return

      // 알 수 없는 세그먼트
      base.push({ label: seg })
    })

    setCrumbs(base)

    // 이름 fetch (비동기)
    if (pending.length === 0) return
    ;(async () => {
      const updates: { idx: number; label: string }[] = []
      await Promise.all(pending.map(async p => {
        try {
          if (p.type === 'project') {
            const res = await fetch(`/api/projects/${p.id}`)
            const data = await res.json()
            const name = data?.name ?? '프로젝트'
            nameCache.set(`proj:${p.id}`, name)
            updates.push({ idx: p.idx, label: name })
          } else if (p.type === 'report') {
            // daily-reports API는 projectId 필요 - URL에서 추출
            const projMatch = pathname.match(/\/projects\/([^\/]+)\//)
            if (!projMatch) return
            const res = await fetch(`/api/projects/${projMatch[1]}/daily-reports/${p.id}`)
            const data = await res.json()
            const label = data?.date ? `${data.date} 일보` : '일보'
            nameCache.set(`report:${p.id}`, label)
            updates.push({ idx: p.idx, label })
          }
        } catch {}
      }))
      if (updates.length > 0) {
        setCrumbs(prev => {
          const next = [...prev]
          for (const u of updates) if (next[u.idx]) next[u.idx] = { ...next[u.idx], label: u.label }
          return next
        })
      }
    })()
  }, [pathname])

  if (crumbs.length === 0) return null

  return (
    <nav className="flex items-center gap-1 px-6 h-9 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 overflow-x-auto" aria-label="경로">
      {crumbs.map((c, i) => (
        <div key={i} className="flex items-center gap-1 flex-shrink-0">
          {i === 0 && <Home size={11} className="text-gray-400" />}
          {c.href ? (
            <Link href={c.href} className="hover:text-gray-900 transition-colors no-underline truncate max-w-[200px]">
              {c.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium truncate max-w-[240px]">{c.label}</span>
          )}
          {i < crumbs.length - 1 && <ChevronRight size={11} className="text-gray-300" />}
        </div>
      ))}
    </nav>
  )
}
