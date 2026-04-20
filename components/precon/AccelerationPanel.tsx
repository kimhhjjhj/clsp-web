'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Zap } from 'lucide-react'
import type { CPMSummary } from '@/lib/types'

interface Accel {
  id: string; category: string; method: string; days: number
  costRate: number; condition: string | null; reference: string | null
}

const EMPTY: Omit<Accel, 'id'> = {
  category: '', method: '', days: 0, costRate: 0, condition: '', reference: '',
}

interface Props {
  projectId: string
  cpmResult: CPMSummary | null
}

export default function AccelerationPanel({ projectId, cpmResult }: Props) {
  const [items, setItems] = useState<Accel[]>([])
  const [form, setForm] = useState<Omit<Accel, 'id'>>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [simResult, setSimResult] = useState<{ original: number; simulated: number; applied: string[] } | null>(null)

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/accelerations`)
    if (res.ok) setItems(await res.json())
  }

  useEffect(() => { load() }, [projectId])

  async function save() {
    if (!form.category || !form.method) return
    if (editId) {
      await fetch(`/api/projects/${projectId}/accelerations/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    } else {
      await fetch(`/api/projects/${projectId}/accelerations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
    }
    setForm(EMPTY); setEditId(null); setShowForm(false); load()
  }

  async function del(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/projects/${projectId}/accelerations/${id}`, { method: 'DELETE' })
    load()
  }

  function startEdit(item: Accel) {
    setForm({ category: item.category, method: item.method, days: item.days,
      costRate: item.costRate, condition: item.condition ?? '', reference: item.reference ?? '' })
    setEditId(item.id); setShowForm(true)
  }

  // CPM 크리티컬패스 공종에 매칭되는 단축 공법 시뮬레이션
  function simulate() {
    if (!cpmResult) return
    const cpTasks = cpmResult.tasks.filter(t => t.isCritical)
    const original = cpmResult.totalDuration
    let saved = 0
    const applied: string[] = []
    for (const task of cpTasks) {
      const match = items.find(a => a.category === task.category || task.name.includes(a.category))
      if (match) {
        saved += match.days
        applied.push(`${task.name} → -${match.days}일 (${match.method})`)
      }
    }
    setSimResult({ original, simulated: Math.max(0, original - saved), applied })
  }

  const totalDays = items.reduce((s, i) => s + i.days, 0)

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase">등록 공법</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{items.length}건</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase">최대 단축 가능</p>
          <p className="text-2xl font-bold text-green-600 mt-1">-{totalDays}일</p>
        </div>
        {simResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase">시뮬레이션 결과</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{simResult.original}일 → {simResult.simulated}일</p>
            <p className="text-xs text-green-600">-{simResult.original - simResult.simulated}일 단축</p>
          </div>
        )}
      </div>

      {/* 툴바 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {cpmResult && (
            <button onClick={simulate}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
              <Zap size={14} /> CP 공종 시뮬레이션
            </button>
          )}
        </div>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-semibold hover:bg-[#1d4ed8]">
          <Plus size={14} /> 공법 추가
        </button>
      </div>

      {/* 시뮬레이션 결과 */}
      {simResult && simResult.applied.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-green-800 mb-2">적용 가능 공법 (크리티컬패스 기준)</h4>
          <ul className="space-y-1">
            {simResult.applied.map((a, i) => (
              <li key={i} className="text-sm text-green-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />{a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 폼 */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-gray-800">{editId ? '공법 수정' : '공법 추가'}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-semibold">공종</label>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="예) 골조공사" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">단축공법명</label>
              <input value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="예) 선행 양생제 적용" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">단축일수</label>
              <input type="number" value={form.days} onChange={e => setForm(p => ({ ...p, days: Number(e.target.value) }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">비용증가율(%)</label>
              <input type="number" value={form.costRate} onChange={e => setForm(p => ({ ...p, costRate: Number(e.target.value) }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">적용조건</label>
              <input value={form.condition ?? ''} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">참고사례</label>
              <input value={form.reference ?? ''} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
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
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              {['공종','단축공법','단축일수','비용증가율','적용조건','참고사례',''].map((h,i) => (
                <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">등록된 공기단축 공법이 없습니다.</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700">{item.category}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{item.method}</td>
                <td className="px-3 py-2 text-green-600 font-semibold">-{item.days}일</td>
                <td className="px-3 py-2 text-orange-600">+{item.costRate}%</td>
                <td className="px-3 py-2 text-gray-500">{item.condition || '—'}</td>
                <td className="px-3 py-2 text-gray-400">{item.reference || '—'}</td>
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
