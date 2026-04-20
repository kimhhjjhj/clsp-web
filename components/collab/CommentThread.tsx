'use client'

// ═══════════════════════════════════════════════════════════
// G1-lite. Universal Comment Thread
//   인증 없이 자유 입력 이름 + 역할(현장/본사/손님) 드롭다운.
//   localStorage 로 마지막 입력 이름·역할 기억해 재입력 부담 제거.
//   본격 인증(G0) 도입 시 author 필드를 User FK로 교체.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { Send, Trash2, Edit2, Check, X, MessageCircle, UserCircle2 } from 'lucide-react'

const NAME_KEY = 'clsp-comment-author-name'
const ROLE_KEY = 'clsp-comment-author-role'

type Role = 'field' | 'hq' | 'guest'

interface Comment {
  id: string
  entityType: string
  entityId: string
  authorName: string
  authorRole: Role
  body: string
  editedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  parentId?: string | null
}

const ROLE_META: Record<Role, { label: string; bg: string; text: string; border: string }> = {
  field: { label: '현장',  bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  hq:    { label: '본사',  bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-200' },
  guest: { label: '손님',  bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200' },
}

function getLocal(): { name: string; role: Role } {
  if (typeof window === 'undefined') return { name: '', role: 'field' }
  return {
    name: localStorage.getItem(NAME_KEY) ?? '',
    role: (localStorage.getItem(ROLE_KEY) as Role) ?? 'field',
  }
}

export default function CommentThread({
  entityType, entityId, title = '토론',
}: {
  entityType: string
  entityId: string
  title?: string
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [input, setInput] = useState('')
  const [author, setAuthor] = useState<{ name: string; role: Role }>({ name: '', role: 'field' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')

  // 초기 로드: localStorage
  useEffect(() => { setAuthor(getLocal()) }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setComments(j.comments ?? [])
    } catch { setComments([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [entityType, entityId])

  function persistAuthor(name: string, role: Role) {
    setAuthor({ name, role })
    if (typeof window !== 'undefined') {
      localStorage.setItem(NAME_KEY, name)
      localStorage.setItem(ROLE_KEY, role)
    }
  }

  async function post() {
    if (!input.trim() || !author.name.trim()) return
    setPosting(true)
    try {
      const r = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType, entityId,
          authorName: author.name,
          authorRole: author.role,
          body: input,
        }),
      })
      if (r.ok) { setInput(''); await load() }
    } finally { setPosting(false) }
  }

  async function saveEdit(id: string) {
    if (!editingBody.trim()) return
    const r = await fetch(`/api/comments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName: author.name, body: editingBody }),
    })
    if (r.ok) {
      setEditingId(null); setEditingBody('')
      await load()
    } else {
      alert('수정 실패 — 이름이 일치하는 작성자만 수정할 수 있습니다')
    }
  }

  async function remove(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const r = await fetch(`/api/comments/${id}?authorName=${encodeURIComponent(author.name)}`, {
      method: 'DELETE',
    })
    if (r.ok) await load()
    else alert('삭제 실패 — 이름이 일치하는 작성자만 삭제할 수 있습니다')
  }

  const needsAuthorName = !author.name.trim()

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <MessageCircle size={14} className="text-slate-500" />
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <span className="text-xs text-slate-400">{comments.length}</span>
      </div>

      {/* 댓글 목록 */}
      <div className="max-h-96 overflow-y-auto p-3 space-y-2">
        {loading && <div className="text-xs text-slate-400 text-center py-4">로드 중...</div>}
        {!loading && comments.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-6">첫 댓글을 남기세요.</div>
        )}
        {comments.map(c => {
          const role = ROLE_META[c.authorRole] ?? ROLE_META.guest
          const isMine = c.authorName === author.name && author.name.trim().length > 0
          const isEditing = editingId === c.id
          return (
            <div key={c.id} className={`p-2 rounded-lg ${isMine ? 'bg-blue-50/60' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2 text-xs mb-1 flex-wrap">
                <span className="font-semibold text-slate-800">{c.authorName}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${role.bg} ${role.text} ${role.border}`}>
                  {role.label}
                </span>
                <span className="text-slate-400 ml-auto tabular-nums">
                  {new Date(c.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {c.editedAt && <span className="ml-1 italic">(수정됨)</span>}
                </span>
                {isMine && !isEditing && (
                  <>
                    <button onClick={() => { setEditingId(c.id); setEditingBody(c.body) }}
                      className="text-slate-300 hover:text-blue-500" title="수정">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => remove(c.id)}
                      className="text-slate-300 hover:text-red-500" title="삭제">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-1">
                  <textarea
                    value={editingBody}
                    onChange={e => setEditingBody(e.target.value)}
                    rows={2}
                    className="w-full p-1.5 text-sm border border-slate-200 rounded bg-white"
                  />
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => { setEditingId(null); setEditingBody('') }}
                      className="h-6 px-2 text-[11px] rounded border border-slate-200 text-slate-600 inline-flex items-center gap-1">
                      <X size={10} /> 취소
                    </button>
                    <button onClick={() => saveEdit(c.id)}
                      className="h-6 px-2 text-[11px] rounded bg-blue-600 text-white inline-flex items-center gap-1">
                      <Check size={10} /> 저장
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{c.body}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* 작성 폼 */}
      <div className="border-t border-slate-200 p-3 space-y-2">
        {needsAuthorName && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            <UserCircle2 size={12} className="text-amber-700 flex-shrink-0" />
            <span className="text-[11px] text-amber-800">댓글 작성 전 이름과 역할을 선택하세요 (이후 자동 기억)</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={author.name}
            onChange={e => persistAuthor(e.target.value, author.role)}
            placeholder="이름"
            maxLength={40}
            className="h-8 px-2 text-xs border border-slate-200 rounded w-28 focus:outline-none focus:border-blue-500"
          />
          <select
            value={author.role}
            onChange={e => persistAuthor(author.name, e.target.value as Role)}
            className="h-8 px-2 text-xs border border-slate-200 rounded bg-white"
          >
            <option value="field">현장</option>
            <option value="hq">본사</option>
            <option value="guest">손님</option>
          </select>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }}
            placeholder={needsAuthorName ? '이름 입력 필요' : '의견 작성... (Enter 전송)'}
            disabled={needsAuthorName || posting}
            className="flex-1 min-w-[160px] h-8 px-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-500 disabled:bg-slate-50"
          />
          <button
            onClick={post}
            disabled={!input.trim() || needsAuthorName || posting}
            className="h-8 px-3 rounded bg-blue-600 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Send size={12} /> 보내기
          </button>
        </div>
      </div>
    </div>
  )
}
