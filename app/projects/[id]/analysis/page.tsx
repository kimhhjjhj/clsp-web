'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Search, Bell, LayoutGrid, MapPin, AlertTriangle,
  Download, Play, Sparkles, CheckSquare, Star,
  ShoppingCart, HardHat, Shield, CheckCircle,
  TrendingUp, Calendar, Activity,
} from 'lucide-react'

const WBS_DATA = [
  { code: 'A100', name: '가설 공사 및 부지 정지',  duration: '15d', pred: '-',         es: 0,  ef: 15, ls: 2,  lf: 17, tf: 2, ff: 0, critical: false },
  { code: 'B210', name: '기초 철근 콘크리트 공사', duration: '24d', pred: 'A100',       es: 15, ef: 39, ls: 15, lf: 39, tf: 0, ff: 0, critical: true  },
  { code: 'C300', name: '전기 설비 배선 공사',     duration: '12d', pred: 'B210',       es: 39, ef: 51, ls: 45, lf: 57, tf: 6, ff: 3, critical: false },
  { code: 'D410', name: '서버실 항온항습기 설치',  duration: '18d', pred: 'B210',       es: 39, ef: 57, ls: 39, lf: 57, tf: 0, ff: 0, critical: true  },
  { code: 'E500', name: '내부 인테리어 마감',      duration: '30d', pred: 'D410, C300', es: 57, ef: 87, ls: 60, lf: 90, tf: 3, ff: 0, critical: false },
  { code: 'F600', name: '네트워크 백본망 구성',    duration: '20d', pred: 'D410',       es: 57, ef: 77, ls: 57, lf: 77, tf: 0, ff: 0, critical: true  },
]

const SIDEBAR_MENU = [
  { label: '프로젝트 수주',   icon: ShoppingCart },
  { label: '설계/엔지니어링', icon: Activity },
  { label: '자재 조달',       icon: TrendingUp },
  { label: '시공 관리',       icon: HardHat,     active: true },
  { label: '안전 점검',       icon: Shield },
  { label: '준공/정산',       icon: CheckCircle },
]

const TOP_TABS = ['대시보드', '현장 현황', '품질 관리', '공정 지표']

function CpmNetworkMap() {
  const nodes = [
    { id: 'A', x: 60,  y: 80,  critical: true  },
    { id: 'B', x: 200, y: 55,  critical: true  },
    { id: 'C', x: 180, y: 130, critical: false },
    { id: 'D', x: 320, y: 80,  critical: true  },
    { id: 'E', x: 310, y: 145, critical: false },
  ]
  const edges = [
    { from: 'A', to: 'B', critical: true  },
    { from: 'A', to: 'C', critical: false },
    { from: 'B', to: 'D', critical: true  },
    { from: 'C', to: 'E', critical: false },
    { from: 'D', to: 'E', critical: false },
  ]
  function pos(id: string) { return nodes.find(n => n.id === id)! }

  return (
    <svg width="100%" height="200" viewBox="0 50 400 160">
      <defs>
        <marker id="arrow-cp"  markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
        </marker>
        <marker id="arrow-std" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const from = pos(e.from), to = pos(e.to)
        const dx = to.x - from.x, dy = to.y - from.y
        const len = Math.sqrt(dx*dx + dy*dy), r = 16
        return (
          <line key={i}
            x1={from.x + (dx/len)*r} y1={from.y + (dy/len)*r}
            x2={to.x   - (dx/len)*(r+4)} y2={to.y - (dy/len)*(r+4)}
            stroke={e.critical ? '#3b82f6' : '#94a3b8'}
            strokeWidth={e.critical ? 2 : 1.5}
            strokeDasharray={e.critical ? 'none' : '4 3'}
            markerEnd={e.critical ? 'url(#arrow-cp)' : 'url(#arrow-std)'}
          />
        )
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={16}
            fill={n.critical ? '#2563eb' : '#475569'}
            stroke={n.critical ? '#93c5fd' : '#64748b'} strokeWidth={1.5} />
          <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
            fill="white" fontSize={13} fontWeight="700">{n.id}</text>
        </g>
      ))}
    </svg>
  )
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} className={
          i <= Math.floor(value) ? 'fill-amber-400 text-amber-400' :
          i - 0.5 <= value      ? 'fill-amber-400/50 text-amber-400' :
          'text-gray-300'
        } />
      ))}
    </div>
  )
}

export default function TongyangAnalysisPage() {
  const [activeTab, setActiveTab]       = useState('품질 관리')
  const [showCritical, setShowCritical] = useState(false)
  const filtered = showCritical ? WBS_DATA.filter(r => r.critical) : WBS_DATA

  return (
    <div className="flex h-screen bg-[#fafafa] overflow-hidden" style={{ fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif' }}>

      {/* 사이드바 */}
      <aside className="w-56 flex-shrink-0 bg-[#1e293b] flex flex-col text-white">
        <div className="px-4 py-5 border-b border-white/10">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Project Lifecycle</p>
          <p className="text-[11px] text-slate-300">통합 공정관리</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {SIDEBAR_MENU.map(({ label, icon: Icon, active }) => (
            <button key={label} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left ${active ? 'bg-[#2563eb] text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <Icon size={15} className="flex-shrink-0" />{label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-3 border-t border-white/10 pt-3">
          <button className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            + 새프로젝트 생성
          </button>
        </div>
        <div className="px-3 pb-4 pt-2 space-y-0.5">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><CheckSquare size={14} />설정</button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><MapPin size={14} />고객지원</button>
        </div>
      </aside>

      {/* 본문 */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* 상단 네비 */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-6 flex-shrink-0">
          <Image src="/tongyang-logo.png" alt="TONGYANG" height={28} width={140} className="object-contain h-7 w-auto" />
          <nav className="flex items-center h-full gap-1 ml-4">
            {TOP_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 h-full text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-[#2563eb] text-[#2563eb]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                {tab}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-gray-100 border border-gray-200 w-44">
              <Search size={13} className="text-gray-400" /><span className="text-xs text-gray-400">Search...</span>
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><Bell size={16} /></button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><LayoutGrid size={16} /></button>
          </div>
        </header>

        {/* 페이지 헤더 */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
          <div>
            <h1 className="text-xl font-bold text-gray-900">프로젝트 분석</h1>
            <p className="text-xs text-gray-500 mt-0.5">유진 목동 데이터센터 건설 공사 (E-2401)</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 font-medium">
              <Download size={14} />보고서 내보내기
            </button>
            <button className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-medium">
              <Play size={13} />공정 재시뮬레이션
            </button>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-auto p-6 space-y-5">

          {/* KPI 4개 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-medium">현재 공정률</p>
                <div className="w-8 h-8 rounded-full border-2 border-[#2563eb] flex items-center justify-center">
                  <TrendingUp size={13} className="text-[#2563eb]" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#2563eb]">68.5%</span>
                <span className="text-xs text-emerald-500 font-semibold">+2.4%</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-gray-100">
                <div className="h-1.5 rounded-full bg-[#2563eb]" style={{ width: '68.5%' }} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-medium">CRITICAL PATH 작업</p>
                <div className="w-8 h-8 rounded-full border-2 border-orange-400 flex items-center justify-center">
                  <Activity size={13} className="text-orange-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">08</span>
                <span className="text-lg font-semibold text-gray-400">건</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">전체 42개 공정 중 19% 차지</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-medium">예상 준공일</p>
                <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center">
                  <Calendar size={13} className="text-gray-400" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">2024.11.24</div>
              <div className="flex items-center gap-1 mt-2">
                <AlertTriangle size={12} className="text-amber-500" />
                <span className="text-[11px] text-amber-500 font-medium">지연 12일 예상</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-medium">품질 지수 (Q-INDEX)</p>
                <div className="w-8 h-8 rounded-full border-2 border-emerald-400 flex items-center justify-center">
                  <CheckCircle size={13} className="text-emerald-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">94.2</div>
              <div className="flex items-center gap-2 mt-2">
                <StarRating value={4.5} />
                <span className="text-[11px] text-gray-400">우수</span>
              </div>
            </div>
          </div>

          {/* WBS + 사이드 */}
          <div className="grid grid-cols-[1fr_320px] gap-5">

            {/* WBS 테이블 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">공정 WBS 및 CPM 분석</h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer" onClick={() => setShowCritical(v => !v)}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${showCritical ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`}>
                      {showCritical && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <span className="text-xs text-gray-600">Critical Path</span>
                  </label>
                  <button className="text-xs text-[#2563eb] font-medium hover:underline">전체 공정보기</button>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 w-20">WBS 코드</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">작업명</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 w-14">기간</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 w-24">선행공정</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 w-10">ES</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 w-10">EF</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 w-10">LS</th>
                    <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 w-10">LF</th>
                    <th className="text-center px-2 py-3 text-xs font-bold text-orange-400 w-10">TF</th>
                    <th className="text-center px-2 py-3 text-xs font-bold text-blue-400 w-10">FF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(row => (
                    <tr key={row.code} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {row.critical && <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />}
                          <span className="text-sm font-medium text-[#2563eb]">{row.code}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-800">{row.name}</td>
                      <td className="px-3 py-3 text-center text-sm text-gray-600 font-mono">{row.duration}</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-400">{row.pred}</td>
                      <td className="px-2 py-3 text-center text-sm text-gray-600">{row.es}</td>
                      <td className="px-2 py-3 text-center text-sm text-gray-600">{row.ef}</td>
                      <td className={`px-2 py-3 text-center text-sm font-medium ${row.critical ? 'text-[#2563eb]' : 'text-gray-600'}`}>{row.ls}</td>
                      <td className={`px-2 py-3 text-center text-sm font-medium ${row.critical ? 'text-[#2563eb]' : 'text-gray-600'}`}>{row.lf}</td>
                      <td className={`px-2 py-3 text-center text-sm font-bold ${row.tf === 0 ? 'text-orange-400' : 'text-gray-500'}`}>{row.tf}</td>
                      <td className={`px-2 py-3 text-center text-sm font-bold ${row.ff === 0 ? 'text-orange-400' : 'text-gray-500'}`}>{row.ff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 오른쪽 사이드 */}
            <div className="space-y-4">
              <div className="bg-[#1e293b] rounded-xl overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-white/10">
                  <span className="text-xs font-bold text-white tracking-widest uppercase">CPM Network Map</span>
                </div>
                <CpmNetworkMap />
                <div className="px-4 pb-4">
                  <button className="w-full h-8 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-medium transition-colors">
                    전체 네트워크 보기
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">현장 위치 정보</span>
                </div>
                <div className="relative h-28 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-[#2563eb] border-2 border-white shadow-md" />
                    <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-[#2563eb]/20 animate-ping" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-white/90 rounded-md px-2 py-1">
                    <p className="text-[9px] text-orange-500 font-medium">● 공기단축 방안 3건 발견</p>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-medium text-gray-800">서울특별시 양천구 목동 917</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">현장 대리인: 김유진 선무 (+82 02-123-4567)</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-xs font-semibold text-red-700">긴급 주의 필요</span>
                </div>
                <p className="text-xs text-red-600">철근 자재수급 지연 (3일)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#2563eb] hover:bg-blue-700 shadow-lg text-white flex items-center justify-center z-50">
        <Sparkles size={20} />
      </button>
    </div>
  )
}
