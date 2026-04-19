'use client'

// ═══════════════════════════════════════════════════════════
// useMultiplierStore — 공종별 생산성 조정값(multiplier) localStorage 영속화
//
// 목적: 프로젝트 단위로 사용자의 수동 조정값을 새로고침·재방문 후에도 복원.
// 원칙: DB 변경 없음. localStorage만 사용. 서버 값은 원본 그대로 보존.
// 키 스킴: `productivity:{projectId}:{mode}`  (프로젝트·모드별로 분리)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'

type Entries = Array<[string, number]>

function storageKey(projectId: string, mode: string) {
  return `productivity:${projectId}:${mode}`
}

function loadFromStorage(key: string): Map<string, number> {
  if (typeof window === 'undefined') return new Map()
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Map()
    const arr = JSON.parse(raw) as Entries
    const m = new Map<string, number>()
    for (const [k, v] of arr) {
      if (typeof k === 'string' && typeof v === 'number' && v > 0) {
        if (Math.abs(v - 1.0) > 0.001) m.set(k, v)  // 1.0은 저장하지 않음
      }
    }
    return m
  } catch {
    return new Map()
  }
}

function saveToStorage(key: string, m: Map<string, number>) {
  if (typeof window === 'undefined') return
  try {
    if (m.size === 0) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, JSON.stringify(Array.from(m.entries())))
    }
  } catch {
    /* 저장 실패 무시 (quota·프라이버시 모드) */
  }
}

export function useMultiplierStore(projectId: string, mode: 'cp' | 'full') {
  const key = storageKey(projectId, mode)
  const [multipliers, setMultipliers] = useState<Map<string, number>>(new Map())
  const hydratedRef = useRef(false)

  // 초기 마운트·projectId/mode 전환 시 로드
  useEffect(() => {
    setMultipliers(loadFromStorage(key))
    hydratedRef.current = true
  }, [key])

  // 변경 시 저장 (하이드레이션 이후만)
  useEffect(() => {
    if (!hydratedRef.current) return
    saveToStorage(key, multipliers)
  }, [key, multipliers])

  const setMult = useCallback((taskId: string, value: number) => {
    setMultipliers(prev => {
      const next = new Map(prev)
      if (Math.abs(value - 1.0) < 0.001) next.delete(taskId)
      else next.set(taskId, value)
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setMultipliers(new Map())
  }, [])

  return { multipliers, setMult, resetAll }
}
