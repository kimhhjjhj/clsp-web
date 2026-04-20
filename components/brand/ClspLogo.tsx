// ═══════════════════════════════════════════════════════════
// CLSP 브랜드 마크 — 정육각형 이소메트릭 큐브
// Construction Lifecycle Solution Platform
// 3면(상·좌·우) = 설계 · 시공 · 운영 통합
// ═══════════════════════════════════════════════════════════
import { useId } from 'react'

interface Props {
  size?: number
  className?: string
  luminous?: boolean
}

/*
 * 정육각형 좌표 (pointy-top, center=50,50, R=45):
 *   top:        (50, 5)
 *   right-up:   (89, 27.5)   [50 + R·√3/2, 50 − R/2]
 *   right-down: (89, 72.5)
 *   bottom:     (50, 95)
 *   left-down:  (11, 72.5)
 *   left-up:    (11, 27.5)
 *
 *   3면 분할선: 중심(50,50)에서 top / left-up / right-up 꼭짓점
 */
export default function ClspLogo({ size = 40, className = '', luminous = false }: Props) {
  // SSR-safe 유니크 id (중복 gradient 방지 + hydration mismatch 회피)
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '')

  // 육각형 꼭짓점
  const T  = '50,5'      // top
  const RU = '89,27.5'   // right-up
  const RD = '89,72.5'   // right-down
  const B  = '50,95'     // bottom
  const LD = '11,72.5'   // left-down
  const LU = '11,27.5'   // left-up
  const C  = '50,50'     // 중심

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="CLSP"
    >
      <defs>
        {/* 상단면 — emerald → teal (준공·데이터 자산) */}
        <linearGradient id={`top-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        {/* 좌측면 — blue → indigo (설계·검토) */}
        <linearGradient id={`left-${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        {/* 우측면 — violet → indigo (시공·운영) */}
        <linearGradient id={`right-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        {/* 내부 음각 — 더 어두운 코어 */}
        <linearGradient id={`inner-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* 외곽 glow (옵션) */}
      {luminous && (
        <circle cx="50" cy="50" r="48"
          fill="none"
          stroke="rgba(99, 102, 241, 0.15)"
          strokeWidth="0.6"
        />
      )}

      {/* ── 외곽 3면 분할 (대칭) ─────────────── */}
      {/* 상단 로즌지 */}
      <polygon points={`${T} ${RU} ${C} ${LU}`} fill={`url(#top-${uid})`} />
      {/* 좌측 로즌지 */}
      <polygon points={`${LU} ${C} ${B} ${LD}`} fill={`url(#left-${uid})`} />
      {/* 우측 로즌지 */}
      <polygon points={`${RU} ${C} ${B} ${RD}`} fill={`url(#right-${uid})`} />

      {/* ── 내부 축소 hex (depth 음각) ─────────
          중심 (50,50) · 축소 반지름 R=22
          좌표:
            top: (50,28)
            right-up: (69, 39)
            right-down: (69, 61)
            bottom: (50, 72)
            left-down: (31, 61)
            left-up: (31, 39)
      */}
      <polygon
        points="50,28 69,39 69,61 50,72 31,61 31,39"
        fill={`url(#inner-${uid})`}
        opacity="0.9"
      />

      {/* 3면 접합선 — 얇은 하이라이트 */}
      <line x1="50" y1="5"  x2="50" y2="50" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="0.6" />
      <line x1="11" y1="27.5" x2="50" y2="50" stroke="rgba(255, 255, 255, 0.10)" strokeWidth="0.4" />
      <line x1="89" y1="27.5" x2="50" y2="50" stroke="rgba(255, 255, 255, 0.10)" strokeWidth="0.4" />

      {/* 상단 외곽 엣지 하이라이트 */}
      <path
        d="M 11 27.5 L 50 5 L 89 27.5"
        fill="none"
        stroke="rgba(255, 255, 255, 0.28)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}
