'use client'

// ═══════════════════════════════════════════════════════════
// 토스트 알림 시스템
// - ToastProvider: 앱 최상위에 한 번 래핑
// - useToast(): { showToast, success, error, info, warning } 반환
// - 자동 닫힘 (기본 2.5초), 수동 닫기
// - 스택 표시 (최대 4개)
// ═══════════════════════════════════════════════════════════

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number       // ms, 0이면 자동 닫힘 없음
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => string
  success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  warning: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 4

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 2500)
    setToasts(prev => {
      const next = [...prev, { ...toast, id }]
      return next.slice(-MAX_TOASTS)
    })
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const success = useCallback((title: string, description?: string) =>
    showToast({ type: 'success', title, description }),
  [showToast])
  const error = useCallback((title: string, description?: string) =>
    showToast({ type: 'error', title, description }),
  [showToast])
  const warning = useCallback((title: string, description?: string) =>
    showToast({ type: 'warning', title, description }),
  [showToast])
  const info = useCallback((title: string, description?: string) =>
    showToast({ type: 'info', title, description }),
  [showToast])

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, dismiss }}>
      {children}
      {mounted && createPortal(
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Provider 없을 때도 안전하게 no-op 반환 (SSR / 테스트)
    return {
      showToast: () => '',
      success: () => '',
      error: () => '',
      warning: () => '',
      info: () => '',
      dismiss: () => {},
    }
  }
  return ctx
}

// ── 토스트 1개 렌더 ─────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { type, title, description } = toast
  const [visible, setVisible] = useState(false)

  useEffect(() => { setVisible(true) }, [])

  const Icon = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }[type]

  const styles: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error:   'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info:    'bg-blue-50 border-blue-200 text-blue-900',
  }
  const iconColor: Record<ToastType, string> = {
    success: 'text-green-500',
    error:   'text-red-500',
    warning: 'text-amber-500',
    info:    'text-blue-500',
  }

  return (
    <div
      className={`pointer-events-auto min-w-[280px] max-w-sm border rounded-lg shadow-lg px-3 py-2.5 flex items-start gap-2 transition-all duration-200 ${styles[type]} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="status"
      aria-live="polite"
    >
      <Icon size={16} className={`flex-shrink-0 mt-0.5 ${iconColor[type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        {description && <p className="text-xs opacity-80 mt-0.5 leading-snug">{description}</p>}
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-0.5 opacity-60 hover:opacity-100 rounded hover:bg-black/5"
        aria-label="알림 닫기"
      >
        <X size={13} />
      </button>
    </div>
  )
}
