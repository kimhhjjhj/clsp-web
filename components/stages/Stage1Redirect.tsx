'use client'

// ═══════════════════════════════════════════════════════════
// Stage1Redirect — 구 1단계(개략공기) URL로 들어온 사용자를
// 새로운 '사업 초기 검토'(/bid)로 안내.
// URL 호환을 위해 완전 자동 리다이렉트 대신 안내 페이지로 제공
// (깊은 링크가 갑자기 튕기면 사용자가 왜 그런지 모름)
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, ArrowRight, Info } from 'lucide-react'

interface Props {
  projectId: string
}

export default function Stage1Redirect({ projectId }: Props) {
  const router = useRouter()

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <ClipboardCheck size={28} className="text-blue-600" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-1.5">
          1단계 개략공기는 사업 초기 검토로 이전됐습니다
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          개략공기와 공사비 산정은 이제 프로젝트 저장 전 단계인<br />
          <strong className="text-gray-800">사업 초기 검토</strong>에서 진행합니다.
        </p>

        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-5 text-left">
          <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-900 leading-relaxed">
            이 프로젝트는 이미 저장된 상태이므로 프리콘(2단계) 이후 단계로 진행하거나,
            재시뮬이 필요하면 사업 초기 검토로 이동하세요.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/bid"
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 no-underline"
          >
            <ClipboardCheck size={14} /> 사업 초기 검토로
          </Link>
          <button
            onClick={() => router.push(`/projects/${projectId}/stage/2`)}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            2단계 프리콘으로 <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
