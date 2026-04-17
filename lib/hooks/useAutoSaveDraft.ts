'use client'

// ═══════════════════════════════════════════════════════════
// useAutoSaveDraft — 편집 중인 데이터를 localStorage에 자동 보관
//
// 용도:
// - 브라우저 닫힘·크래시·네트워크 실패 시 작업 소실 방지
// - 새로고침 시 "미저장 변경 복원" 다이얼로그
// - 서버 버전(updatedAt 등)과 충돌 감지 기본 지원
//
// 원칙:
// - 비파괴: localStorage만 사용, 서버 데이터에 영향 없음
// - debounce 2초 기본 (rapid 편집 시 과다 쓰기 방지)
// - enabled=false일 때 저장 중지 (초기 로드 전 오염 방지)
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'

export interface DraftEnvelope<T> {
  data: T
  savedAt: string       // ISO
  serverVersion?: string
}

interface Options<T> {
  key: string                  // localStorage 키 (프로젝트·리소스 조합으로 고유해야)
  data: T                      // 현재 편집 중인 데이터
  enabled?: boolean            // true일 때만 저장. 초기 로드 전엔 false
  debounceMs?: number          // 기본 2000
  serverVersion?: string       // 서버 마지막 updatedAt 등. 다를 때만 draft 유효로 간주
  // 드래프트를 유효로 볼 최소 조건 (비어있는 상태 저장 방지)
  isMeaningful?: (data: T) => boolean
}

export function useAutoSaveDraft<T>(opts: Options<T>) {
  const { key, data, enabled = true, debounceMs = 2000, serverVersion, isMeaningful } = opts

  const [hasDraft, setHasDraft] = useState(false)
  const [draftEnvelope, setDraftEnvelope] = useState<DraftEnvelope<T> | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const loadedRef = useRef(false)

  // ── 초기 로드 (key 변경 시) ───────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    loadedRef.current = false
    try {
      const raw = localStorage.getItem(key)
      if (!raw) { setHasDraft(false); setDraftEnvelope(null); return }
      const parsed = JSON.parse(raw) as DraftEnvelope<T>
      // 서버 버전이 같다면 이미 저장된 것 — draft 무시하고 삭제
      if (serverVersion && parsed.serverVersion === serverVersion) {
        localStorage.removeItem(key)
        setHasDraft(false)
        setDraftEnvelope(null)
        return
      }
      setDraftEnvelope(parsed)
      setHasDraft(true)
    } catch {
      // 파싱 실패 시 무시
      setHasDraft(false)
      setDraftEnvelope(null)
    } finally {
      loadedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serverVersion])

  // ── 자동 저장 (debounced) ────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!enabled) return
    if (!loadedRef.current) return  // 초기 로드 전엔 저장 금지
    if (isMeaningful && !isMeaningful(data)) return

    const handle = setTimeout(() => {
      try {
        const envelope: DraftEnvelope<T> = {
          data,
          savedAt: new Date().toISOString(),
          serverVersion,
        }
        localStorage.setItem(key, JSON.stringify(envelope))
        setLastSavedAt(envelope.savedAt)
      } catch {
        // 용량 초과 등 무시
      }
    }, debounceMs)
    return () => clearTimeout(handle)
  }, [data, enabled, serverVersion, key, debounceMs, isMeaningful])

  function clearDraft() {
    if (typeof window === 'undefined') return
    try { localStorage.removeItem(key) } catch {}
    setHasDraft(false)
    setDraftEnvelope(null)
    setLastSavedAt(null)
  }

  function applyDraft(applyFn: (data: T) => void) {
    if (draftEnvelope) {
      applyFn(draftEnvelope.data)
      clearDraft()
    }
  }

  return {
    hasDraft,
    draftEnvelope,
    lastSavedAt,
    clearDraft,
    applyDraft,
  }
}
