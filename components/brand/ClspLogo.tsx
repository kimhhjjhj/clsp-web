// ═══════════════════════════════════════════════════════════
// CLSP 브랜드 마크 — 3면 육각형 큐브
// Construction Lifecycle Solution Platform
// 상·좌·우 3면 = 설계·시공·준공 3단계 통합
// ═══════════════════════════════════════════════════════════

interface Props {
  size?: number
  className?: string
  /** 배경 어두운 곳(사이드바 등)에서는 luminous=true */
  luminous?: boolean
}

export default function ClspLogo({ size = 36, className = '', luminous = false }: Props) {
  const uid = Math.random().toString(36).slice(2, 7)
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
        {/* 상단면 — emerald → teal */}
        <linearGradient id={`top-${uid}`} x1="20%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        {/* 좌측면 — blue → indigo (핵심 브랜드) */}
        <linearGradient id={`left-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        {/* 우측면 — violet → indigo */}
        <linearGradient id={`right-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        {/* 내부 음각 — 다크 hex (depth) */}
        <linearGradient id={`inner-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        {/* 하이라이트 엣지 */}
        <linearGradient id={`edge-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.35)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
        </linearGradient>
      </defs>

      {/* 외곽 은은한 glow (luminous 옵션일 때만) */}
      {luminous && (
        <ellipse cx="50" cy="50" rx="48" ry="48" fill="none" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="1" />
      )}

      {/* ── 외곽 육각형 3면 분할 ──────────────────── */}
      {/* 상단 로즌지 */}
      <polygon
        points="50,6  93,30  50,54  7,30"
        fill={`url(#top-${uid})`}
      />
      {/* 좌측 로즌지 */}
      <polygon
        points="7,30  50,54  50,94  7,70"
        fill={`url(#left-${uid})`}
      />
      {/* 우측 로즌지 */}
      <polygon
        points="93,30  50,54  50,94  93,70"
        fill={`url(#right-${uid})`}
      />

      {/* ── 내부 음각 작은 hex cube ─────────────── */}
      {/* 축소 좌표: 중심 (50,54) 기준 0.5배 크기 */}
      <polygon
        points="50,30  71,42  71,66  50,78  29,66  29,42"
        fill={`url(#inner-${uid})`}
        opacity="0.85"
      />

      {/* ── 모서리 하이라이트 (얇은 상단 엣지) ───── */}
      <path
        d="M 7 30 L 50 6 L 93 30"
        stroke={`url(#edge-${uid})`}
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
      />

      {/* 세 면이 만나는 중앙 접합선 (1px) */}
      <line x1="50" y1="6" x2="50" y2="54" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.6" />
    </svg>
  )
}
