'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ShieldAlert, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

interface RO {
  id: string; type: string; category: string; content: string
  impactType: string; impactDays: number | null; impactCost: number | null
  probability: number; response: string | null; owner: string | null; status: string
}

const EMPTY: Omit<RO, 'id'> = {
  type: 'risk', category: '', content: '', impactType: 'schedule',
  impactDays: null, impactCost: null, probability: 50,
  response: '', owner: '', status: 'identified',
}

const STATUS_LABEL: Record<string, string> = { identified: '식별', reviewing: '검토중', closed: '완료' }
const STATUS_COLOR: Record<string, string> = {
  identified: '#f97316', reviewing: '#2563eb', closed: '#16a34a',
}

export default function RiskPanel({ projectId, onUpdate }: { projectId: string; onUpdate?: () => void }) {
  const [items, setItems] = useState<RO[]>([])
  const [form, setForm] = useState<Omit<RO, 'id'>>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [sortType, setSortType] = useState<'all' | 'risk' | 'opportunity'>('all')

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/risks`)
    if (res.ok) setItems(await res.json())
  }

  useEffect(() => { load() }, [projectId])

  async function save() {
    if (!form.category || !form.content) return
    if (editId) {
      await fetch(`/api/projects/${projectId}/risks/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    } else {
      await fetch(`/api/projects/${projectId}/risks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    }
    setForm(EMPTY); setEditId(null); setShowForm(false); load(); onUpdate?.()
  }

  async function del(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/projects/${projectId}/risks/${id}`, { method: 'DELETE' })
    load(); onUpdate?.()
  }

  function startEdit(item: RO) {
    setForm({ type: item.type, category: item.category, content: item.content, impactType: item.impactType,
      impactDays: item.impactDays, impactCost: item.impactCost, probability: item.probability,
      response: item.response ?? '', owner: item.owner ?? '', status: item.status })
    setEditId(item.id); setShowForm(true)
  }

  const filtered = sortType === 'all' ? items : items.filter(i => i.type === sortType)
  const risks = items.filter(i => i.type === 'risk')
  const opps  = items.filter(i => i.type === 'opportunity')
  const riskDays = risks.reduce((s, i) => s + (i.impactDays ?? 0), 0)
  const oppDays  = opps.reduce((s, i)  => s + (i.impactDays ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '총 리스크', value: risks.length + '건', sub: `공기영향 +${riskDays.toFixed(1)}일`, color: '#ef4444', icon: <ShieldAlert size={16} /> },
          { label: '총 기회',   value: opps.length  + '건', sub: `공기단축 -${oppDays.toFixed(1)}일`,  color: '#16a34a', icon: <TrendingUp size={16} /> },
          { label: '식별 중',   value: items.filter(i => i.status === 'identified').length + '건', sub: '조치 필요', color: '#f97316', icon: <AlertTriangle size={16} /> },
          { label: '완료',      value: items.filter(i => i.status === 'closed').length + '건',      sub: '처리 완료', color: '#2563eb', icon: <CheckCircle2 size={16} /> },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1" style={{ color: k.color }}>{k.icon}<span className="text-xs font-semibold text-gray-500">{k.label}</span></div>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* 툴바 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all','risk','opportunity'] as const).map(t => (
            <button key={t} onClick={() => setSortType(t)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${sortType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'all' ? '전체' : t === 'risk' ? '리스크' : '기회'}
            </button>
          ))}
        </div>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8]">
          <Plus size={14} /> 항목 추가
        </button>
      </div>

      {/* 폼 */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-gray-800">{editId ? '항목 수정' : '새 항목 추가'}</h4>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold">구분</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="risk">리스크</option>
                <option value="opportunity">기회</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">공종</label>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="예) 골조공사" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">영향 유형</label>
              <select value={form.impactType} onChange={e => setForm(p => ({ ...p, impactType: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="schedule">공기</option>
                <option value="cost">원가</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">
                {form.impactType === 'schedule' ? '영향 일수' : '영향 금액(만원)'}
              </label>
              <input type="number"
                value={form.impactType === 'schedule' ? (form.impactDays ?? '') : (form.impactCost ?? '')}
                onChange={e => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  setForm(p => form.impactType === 'schedule' ? { ...p, impactDays: v } : { ...p, impactCost: v })
                }}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold">내용</label>
            <input value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="리스크/기회 내용을 입력하세요" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold">확률 ({form.probability}%)</label>
              <input type="range" min={0} max={100} step={5} value={form.probability}
                onChange={e => setForm(p => ({ ...p, probability: Number(e.target.value) }))}
                className="mt-1 w-full accent-[#2563eb]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">담당자</label>
              <input value={form.owner ?? ''} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">상태</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="identified">식별</option>
                <option value="reviewing">검토중</option>
                <option value="closed">완료</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">대응방안</label>
              <input value={form.response ?? ''} onChange={e => setForm(p => ({ ...p, response: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save}
              className="px-4 py-2 text-sm font-semibold bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">저장</button>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['구분','공종','내용','영향','확률','대응방안','담당자','상태',''].map((h,i) => (
                <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">항목이 없습니다.</td></tr>
            )}
            {filtered.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${item.type === 'risk' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {item.type === 'risk' ? '리스크' : '기회'}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{item.category}</td>
                <td className="px-3 py-2 text-gray-900 max-w-[200px] truncate">{item.content}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                  {item.impactType === 'schedule'
                    ? <span className={item.type === 'risk' ? 'text-red-600' : 'text-green-600'}>{item.type === 'risk' ? '+' : '-'}{item.impactDays ?? 0}일</span>
                    : <span className="text-gray-600">{item.impactCost ?? 0}만원</span>}
                </td>
                <td className="px-3 py-2 text-gray-600">{item.probability}%</td>
                <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{item.response || '—'}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{item.owner || '—'}</td>
                <td className="px-3 py-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: STATUS_COLOR[item.status] + '20', color: STATUS_COLOR[item.status] }}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(item)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={13} /></button>
                    <button onClick={() => del(item.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
