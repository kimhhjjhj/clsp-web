'use client'

// ═══════════════════════════════════════════════════════════
// 전역 키보드 단축키 (Gmail 스타일)
// ─────────────────────────────────────────────────────────
//  g → d   대시보드
//  g → p   프로젝트
//  g → b   사업 초기 검토
//  g → s   생산성 DB (Standards)
//  g → a   분석 (Analytics)
//  n       새 프로젝트
//  /       ⌘K 검색 열기 (이미 있는 ⌘K와 병행)
//  ?       단축키 도움말 토글
//
// 사용법: layout에서 <GlobalShortcuts /> 한 번만 마운트
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Keyboard } from 'lucide-react'
import { useCommandPalette } from './CommandPalette'

const LEADER_TIMEOUT = 1500

type ShortcutMap = Record<string, { action: () => void; label: string }>

export default function GlobalShortcuts() {
  const router = useRouter()
  const palette = useCommandPalette()
  const [leader, setLeader] = useState<'g' | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const leaderG: ShortcutMap = {
    d: { action: () => router.push('/'),          label: '대시보드' },
    p: { action: () => router.push('/projects'),  label: '프로젝트' },
    b: { action: () => router.push('/bid'),       label: '사업 초기 검토' },
    s: { action: () => router.push('/standards'), label: '생산성 DB' },
    a: { action: () => router.push('/analytics'), label: '분석' },
    r: { action: () => router.push('/risks'),     label: 'R&O' },
    c: { action: () => router.push('/companies'), label: '협력사' },
    i: { action: () => router.push('/import'),    label: '엑셀 임포트' },
  }

  const isTypingTarget = useCallback((e: KeyboardEvent) => {
    const el = e.target as HTMLElement
    if (!el) return false
    const tag = el.tagName
    return (
      tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
      el.isContentEditable ||
      el.getAttribute('role') === 'textbox'
    )
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 입력 중이면 단축키 비활성
      if (isTypingTarget(e)) return
      // 수정자 키 눌림 상태면 무시 (⌘K 등은 CommandPalette가 처리)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      // leader g 대기 중이면 다음 키 매핑 시도
      if (leader === 'g') {
        if (leaderG[key]) {
          e.preventDefault()
          leaderG[key].action()
        }
        setLeader(null)
        return
      }

      // 단일 단축키
      if (key === 'g') {
        setLeader('g')
        setTimeout(() => setLeader(l => (l === 'g' ? null : l)), LEADER_TIMEOUT)
        return
      }
      if (key === 'n') {
        e.preventDefault()
        router.push('/projects/new')
        return
      }
      if (key === '/') {
        e.preventDefault()
        palette.open()
        return
      }
      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault()
        setHelpOpen(h => !h)
        return
      }
      if (key === 'escape') {
        if (helpOpen) setHelpOpen(false)
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leader, helpOpen])

  return (
    <>
      {/* Leader 'g' 대기 중 인디케이터 */}
      {leader === 'g' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 text-xs font-mono animate-in fade-in">
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded">g</kbd>
          <span className="text-gray-400">→</span>
          <span className="text-gray-300">다음 키: d·p·b·s·a·r·c·i</span>
        </div>
      )}

      {/* 도움말 모달 */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Keyboard size={16} className="text-gray-600" />
              <h3 className="text-sm font-bold text-gray-900">키보드 단축키</h3>
              <button
                onClick={() => setHelpOpen(false)}
                className="ml-auto p-1 text-gray-400 hover:text-gray-700"
                aria-label="닫기"
              ><X size={14} /></button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-auto">
              <Group label="탐색">
                <Row keys={['g', 'd']} label="대시보드" />
                <Row keys={['g', 'p']} label="프로젝트" />
                <Row keys={['g', 'b']} label="사업 초기 검토" />
                <Row keys={['g', 's']} label="생산성 DB" />
                <Row keys={['g', 'a']} label="분석" />
                <Row keys={['g', 'r']} label="R&O" />
                <Row keys={['g', 'c']} label="협력사" />
                <Row keys={['g', 'i']} label="엑셀 임포트" />
              </Group>
              <Group label="액션">
                <Row keys={['n']} label="새 프로젝트" />
                <Row keys={['⌘', 'K']} label="전역 검색 열기" />
                <Row keys={['/']} label="전역 검색 열기 (대안)" />
                <Row keys={['?']} label="이 도움말 토글" />
                <Row keys={['Esc']} label="모달·팔레트 닫기" />
              </Group>
              <p className="text-[10px] text-gray-400 leading-relaxed pt-1 border-t border-gray-100">
                입력 필드·편집기에 포커스가 있을 때는 단축키가 비활성화됩니다.
                <br />
                g 누른 후 1.5초 안에 다음 키를 눌러야 합니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-700">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">→</span>}
            <kbd className="inline-flex items-center justify-center min-w-[22px] h-6 px-1.5 rounded border border-gray-300 bg-gray-50 text-[10px] font-mono font-semibold text-gray-700 shadow-sm">
              {k}
            </kbd>
          </span>
        ))}
      </span>
    </div>
  )
}
