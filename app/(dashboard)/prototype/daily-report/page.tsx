'use client'

import React, { useState } from 'react'
import {
  Calendar, Cloud, Sun, CloudRain, Thermometer, Copy, Save, Users, HardHat,
  Wrench, Package, AlertTriangle, ChevronDown, ChevronRight, Plus, X, Check,
  FileText, ArrowLeft, Search,
} from 'lucide-react'

const STEPS = [
  { id: 1, name: '기본정보', icon: Calendar },
  { id: 2, name: '작업내용', icon: FileText },
  { id: 3, name: '투입인원', icon: Users },
  { id: 4, name: '자재·장비', icon: Wrench },
]

const COMPANIES_DEFAULT = [
  { trade: '관리', name: '㈜동양', yesterday: 7184, today: 0, total: 7184 },
  { trade: '직영인부', name: '㈜동양', yesterday: 3537, today: 0, total: 3537 },
  { trade: '골조', name: '발해건설㈜', yesterday: 6559, today: 24, total: 6583 },
  { trade: '철근', name: '발해건설㈜', yesterday: 5779, today: 12, total: 5791 },
  { trade: '형틀', name: '발해건설㈜', yesterday: 6559, today: 18, total: 6577 },
  { trade: '타워크레인', name: '㈜한산타워', yesterday: 127, today: 2, total: 129 },
  { trade: '내장', name: '㈜아코인', yesterday: 4647, today: 2, total: 4649 },
  { trade: '타일', name: '㈜에코송이', yesterday: 2659, today: 1, total: 2660 },
  { trade: '준공청소', name: '㈜모던기업', yesterday: 772, today: 4, total: 776 },
]

export default function DailyReportPrototypePage() {
  const [step, setStep] = useState(1)
  const [weather, setWeather] = useState<'맑음' | '흐림' | '비'>('맑음')
  const [tempMin, setTempMin] = useState('1')
  const [tempMax, setTempMax] = useState('9')
  const [companies, setCompanies] = useState(COMPANIES_DEFAULT)
  const [showZero, setShowZero] = useState(false)
  const [search, setSearch] = useState('')

  const visibleCompanies = companies
    .filter(c => showZero || c.today > 0 || c.today === 0)
    .filter(c =>
      search === '' ||
      c.trade.includes(search) ||
      c.name.includes(search)
    )

  const activeCompanies = companies.filter(c => c.today > 0)
  const totalToday = companies.reduce((s, c) => s + c.today, 0)

  return (
    <div className="min-h-full bg-gray-50">
      {/* 상단 고정 요약 바 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="text-xs text-gray-400 font-medium">PROTOTYPE · 저장 안됨</div>
              <h1 className="text-base font-bold text-gray-900">일일 작업일보 작성</h1>
            </div>
          </div>

          {/* 실시간 요약 */}
          <div className="flex items-center gap-4">
            <SummaryChip icon={<Calendar size={14} />} label="2026.04.17 (금)" />
            <SummaryChip icon={<Cloud size={14} />} label={`${weather} · ${tempMin}°/${tempMax}°`} />
            <SummaryChip
              icon={<Users size={14} />}
              label={`총 ${totalToday}명 · ${activeCompanies.length}개 업체`}
              highlight
            />
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Copy size={12} /> 어제 일보 복제
            </button>
            <button className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              <Save size={12} /> 저장
            </button>
          </div>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="px-8 pb-2 flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = step === s.id
            const done = step > s.id
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : done
                      ? 'text-emerald-600 hover:bg-gray-50'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {done ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <Icon size={14} />
                  )}
                  <span className="text-[11px] font-bold tracking-wider text-gray-400">
                    {String(s.id).padStart(2, '0')}
                  </span>
                  {s.name}
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight size={14} className="text-gray-300" />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* 본문 */}
      <div className="px-8 py-6 max-w-6xl">
        {step === 1 && (
          <Section
            title="기본 정보"
            desc="날짜와 기상 조건. 이 값들은 상단 요약바에 실시간 반영됩니다."
          >
            <div className="grid grid-cols-4 gap-4">
              <Field label="작성일">
                <input
                  type="date"
                  defaultValue="2026-04-17"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="날씨">
                <div className="flex gap-1">
                  {(['맑음', '흐림', '비'] as const).map(w => (
                    <button
                      key={w}
                      onClick={() => setWeather(w)}
                      className={`flex-1 px-2 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        weather === w
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {w === '맑음' && <Sun size={14} className="inline mr-1" />}
                      {w === '흐림' && <Cloud size={14} className="inline mr-1" />}
                      {w === '비' && <CloudRain size={14} className="inline mr-1" />}
                      {w}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="최저기온 (°C)">
                <input
                  value={tempMin}
                  onChange={e => setTempMin(e.target.value)}
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="최고기온 (°C)">
                <input
                  value={tempMax}
                  onChange={e => setTempMax(e.target.value)}
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <SignerBox label="현장소장" signed />
              <SignerBox label="공무" signed />
              <SignerBox label="담당" />
            </div>
          </Section>
        )}

        {step === 2 && (
          <>
            <Section
              title="금일 작업내용"
              desc="공종별로 항목을 추가하세요. '어제 일보 복제' 시 자동 채워집니다."
            >
              <WorkCategorySection category="건축" items={['세대 내부 잔손보기', '저층부 유리 청소']} />
              <WorkCategorySection category="기계·소방설비" items={['세대 소화기 비치 준비']} />
            </Section>

            <Section title="명일 작업내용" desc="내일 예정 작업을 공종별로 작성.">
              <WorkCategorySection category="건축" items={['세대 내부 잔손보기']} />
              <WorkCategorySection category="기계·소방설비" items={['세대 소화기 비치']} />
            </Section>

            <Section title="특기사항" desc="안전·품질·민원 등 현장 이슈.">
              <textarea
                rows={3}
                placeholder="예) 14:00 지하 1층 B구역 누수 발생 — 방수업체 긴급 투입 예정"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </Section>
          </>
        )}

        {step === 3 && (
          <Section
            title="업체별 투입인원"
            desc="0명 업체는 기본 숨김. 전일·누계는 이전 일보에서 자동 계산. 숫자 입력 후 Tab으로 다음 셀."
          >
            {/* 툴바 */}
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="flex-1 max-w-sm relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="공종 또는 업체명 검색..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showZero}
                    onChange={e => setShowZero(e.target.checked)}
                  />
                  0명 업체 표시
                </label>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                  <Plus size={12} /> 업체 추가
                </button>
              </div>
            </div>

            {/* 표 */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-xs text-gray-500">
                    <th className="text-left px-4 py-2 font-semibold">공종</th>
                    <th className="text-left px-4 py-2 font-semibold">업체명</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-400">전일</th>
                    <th className="text-right px-4 py-2 font-semibold bg-blue-50 text-blue-700">
                      금일 <span className="font-normal">(입력)</span>
                    </th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-400">누계 (자동)</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleCompanies.map((c, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-blue-50/30 ${c.today > 0 ? 'bg-blue-50/20' : ''}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-800">{c.trade}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 font-mono">
                        {c.yesterday.toLocaleString()}
                      </td>
                      <td className="px-1 py-1 bg-blue-50/30">
                        <input
                          type="number"
                          value={c.today || ''}
                          placeholder="0"
                          onChange={e => {
                            const val = Number(e.target.value) || 0
                            setCompanies(prev =>
                              prev.map((x, i) =>
                                i === companies.indexOf(c)
                                  ? { ...x, today: val, total: x.yesterday + val }
                                  : x,
                              ),
                            )
                          }}
                          className="w-full text-right font-mono text-blue-900 font-semibold bg-transparent border border-transparent hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded px-2 py-1.5 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                        {c.total.toLocaleString()}
                      </td>
                      <td className="px-2">
                        <button className="p-1 text-gray-300 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-900 text-white">
                  <tr>
                    <td className="px-4 py-2.5 font-bold" colSpan={2}>
                      합계
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-300">
                      {companies.reduce((s, c) => s + c.yesterday, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-300">
                      {totalToday.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold">
                      {companies.reduce((s, c) => s + c.total, 0).toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
              <HardHat size={12} />
              엑셀 원본은 50+ 업체 중 당일 활동 3~5개. 이 화면은 <b>금일 입력 열만 활성</b> — 나머지는 전일 일보에서 자동 세팅.
            </div>
          </Section>
        )}

        {step === 4 && (
          <>
            <Section
              title="장비 투입현황"
              desc="자주 쓰는 장비는 상단 고정. 금일 투입량만 입력."
            >
              <EquipmentQuickRow name="타워크레인" spec="—" yesterday={694} today={0} />
              <EquipmentQuickRow name="펌프카" spec="55t" yesterday={40} today={0} />
              <EquipmentQuickRow name="덤프트럭" spec="25Ton" yesterday={1367} today={0} />
              <button className="mt-2 text-xs text-blue-600 font-semibold inline-flex items-center gap-1">
                <Plus size={12} /> 장비 추가
              </button>
            </Section>

            <Section title="자재 투입현황" desc="규격별로 금회 투입량만. 누계·잔량은 자동.">
              <MaterialQuickRow
                name="레미콘"
                spec="25-21-150"
                design={37982}
                prev={32903}
                today={0}
              />
              <MaterialQuickRow
                name="철근"
                spec="SHD13"
                design={1600}
                prev={1328}
                today={0}
              />
              <button className="mt-2 text-xs text-blue-600 font-semibold inline-flex items-center gap-1">
                <Plus size={12} /> 자재 추가
              </button>
            </Section>
          </>
        )}

        {/* 하단 네비게이션 */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-sm text-gray-400">
            {step} / {STEPS.length}
          </span>
          {step < STEPS.length ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              다음
            </button>
          ) : (
            <button className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              저장하고 닫기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryChip({
  icon,
  label,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  highlight?: boolean
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
        highlight ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'
      }`}
    >
      {icon}
      {label}
    </div>
  )
}

function Section({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

function SignerBox({ label, signed }: { label: string; signed?: boolean }) {
  return (
    <div
      className={`border-2 border-dashed rounded-xl h-20 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
        signed
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {signed ? (
        <Check size={18} className="text-emerald-500" />
      ) : (
        <Plus size={16} className="text-gray-300" />
      )}
      <span className="text-xs font-semibold text-gray-500">{label}</span>
    </div>
  )
}

function WorkCategorySection({ category, items }: { category: string; items: string[] }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
          ▷ {category}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700"
          >
            <span className="text-gray-300">—</span>
            <span className="flex-1">{item}</span>
            <button className="text-gray-300 hover:text-red-500">
              <X size={12} />
            </button>
          </div>
        ))}
        <button className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold mt-1">
          <Plus size={12} /> 항목 추가
        </button>
      </div>
    </div>
  )
}

function EquipmentQuickRow({
  name,
  spec,
  yesterday,
  today,
}: {
  name: string
  spec: string
  yesterday: number
  today: number
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-800">{name}</div>
        <div className="text-xs text-gray-400">{spec}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-gray-400">전일</div>
        <div className="text-sm font-mono text-gray-500">{yesterday}</div>
      </div>
      <div className="text-right w-20">
        <div className="text-[10px] text-blue-600 font-semibold">금일</div>
        <input
          type="number"
          defaultValue={today || ''}
          placeholder="0"
          className="w-full text-right font-mono text-sm font-semibold text-blue-900 border border-blue-200 rounded-md px-2 py-1 bg-blue-50/30"
        />
      </div>
      <div className="text-right w-20">
        <div className="text-[10px] text-gray-400">누계</div>
        <div className="text-sm font-mono text-gray-700">{yesterday + today}</div>
      </div>
    </div>
  )
}

function MaterialQuickRow({
  name,
  spec,
  design,
  prev,
  today,
}: {
  name: string
  spec: string
  design: number
  prev: number
  today: number
}) {
  const total = prev + today
  const remain = design - total
  const pct = Math.round((total / design) * 100)
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-800">
            {name} <span className="text-gray-400 font-normal">· {spec}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400">설계량</div>
          <div className="text-sm font-mono text-gray-700">{design.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400">전회</div>
          <div className="text-sm font-mono text-gray-500">{prev.toLocaleString()}</div>
        </div>
        <div className="text-right w-24">
          <div className="text-[10px] text-blue-600 font-semibold">금회</div>
          <input
            type="number"
            defaultValue={today || ''}
            placeholder="0"
            className="w-full text-right font-mono text-sm font-semibold text-blue-900 border border-blue-200 rounded-md px-2 py-1 bg-blue-50/30"
          />
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400">잔량</div>
          <div className="text-sm font-mono text-emerald-600 font-semibold">
            {remain.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-gray-400 mt-1 text-right">진행률 {pct}%</div>
    </div>
  )
}
