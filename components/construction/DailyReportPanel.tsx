'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, CalendarDays, Cloud, Thermometer, Users } from 'lucide-react'

interface DailyReport {
  id: string; date: string; weather: string | null; temperature: number | null
  workers: Record<string, number> | null; equipment: string | null
  content: string | null; notes: string | null; photos: string | null
}

const WORKER_CATS = ['골조','철근','형틀','방수','마감','설비','전기','기타']
const WEATHER_OPTIONS = ['맑음','구름많음','흐림','비','눈','강풍']

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  weather: '맑음', temperature: null as number | null,
  workers: {} as Record<string, number>,
  equipment: '', content: '', notes: '', photos: '',
}

export default function DailyReportPanel({ projectId, onSaved }: { projectId: string; onSaved?: () => void }) {
  const [reports, setReports] = useState<DailyReport[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<DailyReport | null>(null)

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/daily-reports`)
    if (res.ok) setReports(await res.json())
  }

  useEffect(() => { load() }, [projectId])

  async function save() {
    if (!form.date) return
    const body = { ...form, workers: Object.keys(form.workers).length > 0 ? form.workers : null }
    if (editId) {
      await fetch(`/api/projects/${projectId}/daily-reports/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } else {
      await fetch(`/api/projects/${projectId}/daily-reports`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }
    setForm(EMPTY_FORM); setEditId(null); setShowForm(false); load(); onSaved?.()
  }

  async function del(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/projects/${projectId}/daily-reports/${id}`, { method: 'DELETE' })
    if (selected?.id === id) setSelected(null)
    load(); onSaved?.()
  }

  function startEdit(r: DailyReport) {
    setForm({
      date: r.date, weather: r.weather ?? '맑음', temperature: r.temperature,
      workers: (r.workers as Record<string, number>) ?? {},
      equipment: r.equipment ?? '', content: r.content ?? '',
      notes: r.notes ?? '', photos: r.photos ?? '',
    })
    setEditId(r.id); setShowForm(true)
  }

  const setWorker = (cat: string, val: number) =>
    setForm(p => ({ ...p, workers: { ...p.workers, [cat]: val } }))

  const totalWorkers = (r: DailyReport) =>
    r.workers ? Object.values(r.workers as Record<string, number>).reduce((s,v) => s + v, 0) : 0

  return (
    <div className="flex gap-4" style={{ minHeight: 500 }}>
      {/* 왼쪽: 목록 */}
      <div className="w-72 flex-shrink-0 space-y-2">
        <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); setSelected(null) }}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2563eb] text-white rounded-xl text-sm font-semibold hover:bg-[#1d4ed8]">
          <Plus size={14} /> 일보 작성
        </button>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {reports.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">작성된 일보가 없습니다.</p>
          )}
          {reports.map(r => (
            <div key={r.id}
              onClick={() => { setSelected(r); setShowForm(false) }}
              className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === r.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{r.date}</span>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); startEdit(r) }} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={11} /></button>
                  <button onClick={e => { e.stopPropagation(); del(r.id) }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={11} /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                <span>{r.weather || '—'}</span>
                {r.temperature != null && <span>{r.temperature}°C</span>}
                <span>투입 {totalWorkers(r)}명</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽: 폼 또는 상세 */}
      <div className="flex-1 min-w-0">
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-gray-800">{editId ? '일보 수정' : '일일 작업일보 작성'}</h4>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500">날짜</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">날씨</label>
                <select value={form.weather ?? ''} onChange={e => setForm(p => ({ ...p, weather: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {WEATHER_OPTIONS.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">기온(°C)</label>
                <input type="number" value={form.temperature ?? ''} onChange={e => setForm(p => ({ ...p, temperature: e.target.value === '' ? null : Number(e.target.value) }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">투입인원 (공종별)</label>
              <div className="grid grid-cols-4 gap-2">
                {WORKER_CATS.map(cat => (
                  <div key={cat} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5">
                    <span className="text-xs text-gray-500 w-8 flex-shrink-0">{cat}</span>
                    <input type="number" min={0} value={form.workers[cat] ?? ''} onChange={e => setWorker(cat, Number(e.target.value))}
                      className="w-full bg-transparent text-sm font-mono text-center border-0 outline-none" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500">장비</label>
              <input value={form.equipment} onChange={e => setForm(p => ({ ...p, equipment: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="예) 타워크레인 1대, 펌프카 1대" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500">작업내용</label>
              <textarea rows={3} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="금일 주요 작업 내용" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500">특이사항</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="안전, 품질, 민원 등 특이사항" />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={save}
                className="px-4 py-2 text-sm font-semibold bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8]">저장</button>
            </div>
          </div>
        )}

        {selected && !showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays size={16} className="text-[#2563eb]" />
                {selected.date} 작업일보
              </h4>
              <button onClick={() => startEdit(selected)} className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"><Pencil size={12} />수정</button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                <Cloud size={16} className="text-blue-400" />
                <div>
                  <p className="text-xs text-gray-400">날씨</p>
                  <p className="font-semibold text-gray-800">{selected.weather || '—'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                <Thermometer size={16} className="text-orange-400" />
                <div>
                  <p className="text-xs text-gray-400">기온</p>
                  <p className="font-semibold text-gray-800">{selected.temperature != null ? `${selected.temperature}°C` : '—'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                <Users size={16} className="text-green-400" />
                <div>
                  <p className="text-xs text-gray-400">총 투입인원</p>
                  <p className="font-semibold text-gray-800">{totalWorkers(selected)}명</p>
                </div>
              </div>
            </div>

            {selected.workers && Object.keys(selected.workers).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">공종별 투입인원</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selected.workers as Record<string, number>).filter(([,v]) => v > 0).map(([k,v]) => (
                    <span key={k} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-lg font-semibold">{k} {v}명</span>
                  ))}
                </div>
              </div>
            )}

            {selected.equipment && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">장비</p>
                <p className="text-sm text-gray-700">{selected.equipment}</p>
              </div>
            )}

            {selected.content && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">작업내용</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{selected.content}</p>
              </div>
            )}

            {selected.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">특이사항</p>
                <p className="text-sm text-orange-700 bg-orange-50 rounded-lg p-3 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}
          </div>
        )}

        {!showForm && !selected && (
          <div className="flex items-center justify-center h-full bg-white border border-gray-200 rounded-xl text-gray-400">
            <div className="text-center">
              <CalendarDays size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm">왼쪽에서 일보를 선택하거나 새로 작성하세요.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
