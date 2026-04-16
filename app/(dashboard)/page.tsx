'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Building2, Clock, ChevronRight, Trash2 } from 'lucide-react'

interface Project {
  id: string
  name: string
  client?: string
  location?: string
  type?: string
  ground: number
  basement: number
  bldgArea?: number
  createdAt: string
  _count: { tasks: number }
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function deleteProject(id: string, name: string) {
    if (!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?`)) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">프로젝트 목록</h1>
          <p className="text-sm text-gray-500 mt-1">공동주택 개략공기 산정 프로젝트를 관리합니다</p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          새 프로젝트
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="전체 프로젝트" value={projects.length} unit="개" />
        <StatCard
          label="평균 연면적"
          value={
            projects.length
              ? Math.round(projects.reduce((s, p) => s + (p.bldgArea ?? 0), 0) / projects.length).toLocaleString()
              : '—'
          }
          unit="m²"
        />
        <StatCard
          label="평균 규모"
          value={
            projects.length
              ? Math.round(projects.reduce((s, p) => s + p.ground, 0) / projects.length)
              : '—'
          }
          unit="층"
        />
      </div>

      {/* 프로젝트 목록 */}
      {loading ? (
        <div className="text-center text-gray-500 py-20">불러오는 중...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="mx-auto text-gray-700 mb-4" size={48} />
          <p className="text-gray-500 mb-4">아직 프로젝트가 없습니다</p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            첫 프로젝트 만들기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {projects.map(project => (
            <div
              key={project.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4 hover:border-gray-700 transition-colors group"
            >
              {/* 아이콘 */}
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 size={20} className="text-blue-400" />
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">{project.name}</h3>
                  {project.type && (
                    <span className="text-[11px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                      {project.type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {project.location && <span>{project.location}</span>}
                  <span>지상 {project.ground}F / 지하 {project.basement}F</span>
                  {project.bldgArea && (
                    <span>연면적 {project.bldgArea.toLocaleString()}m²</span>
                  )}
                </div>
              </div>

              {/* 태스크 수 */}
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Clock size={13} />
                <span>{project._count.tasks}개 공종</span>
              </div>

              {/* 날짜 */}
              <div className="text-xs text-gray-600 hidden md:block">
                {new Date(project.createdAt).toLocaleDateString('ko-KR')}
              </div>

              {/* 삭제 버튼 */}
              <button
                onClick={e => { e.preventDefault(); deleteProject(project.id, project.name) }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-red-400 transition-all"
              >
                <Trash2 size={15} />
              </button>

              {/* 이동 링크 */}
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                공기산정 <ChevronRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </p>
    </div>
  )
}
