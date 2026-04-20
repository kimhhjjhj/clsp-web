// 상봉동 프로젝트에 Claude Opus 4.7 공기 추론값 주입
// 1회성 시드 스크립트. 실행: node scripts/seed-sangbong-ai-schedule.mjs

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const SANGBONG_ID = 'cmo2w9mcf01yp7yzesow2skqn'

const estimate = {
  totalDuration: 885,
  rangeMin: 860,
  rangeMax: 920,
  confidence: 'medium',
  estimator: 'Claude Opus 4.7',
  estimatedAt: '2026-04-20',
  factors: [
    {
      label: '공동주택 20층 기본 (순타)',
      days: '900~1000',
      note: '업계 밴드 고층(16~25F) 720~960일 중 20층 중간값',
    },
    {
      label: 'Semi Top-down (CWS) 단축',
      days: '-80~-120',
      note: '지상·지하 병렬 시공. 상봉동 CWS 공법 전형적 -3~4개월',
    },
    {
      label: '전이층 양생·구조',
      days: '+25~35',
      note: 'Transfer Slab 판넬 두께·양생 추가 공기',
    },
    {
      label: '풍화암 16.8m 굴착',
      days: '+20~30',
      note: 'PRD 20공 천공·CIP·깊은 흙막이',
    },
    {
      label: '도심지 민원·교통 통제',
      days: '+15~25',
      note: '서울 중랑구 중량 공사 평균',
    },
  ],
  rationale:
    '공동주택 20층 연면적 17,360㎡이면 순타 기준 900~1,000일. Semi Top-down으로 지상·지하 병렬 시공해 약 100일 단축. 전이층·깊은 굴착·도심지 추가 요인 +60~90일 더해 860~920일 범위 추정. CPM 859일 결과와 거의 일치하며 업계 밴드(720~960) 상단. 상봉동은 중간값인 880~890일이 현실적.',
}

async function main() {
  const existing = await prisma.project.findUnique({
    where: { id: SANGBONG_ID },
    select: { id: true, name: true, aiScheduleEstimate: true },
  })
  if (!existing) {
    console.error(`프로젝트 ${SANGBONG_ID} 없음`)
    process.exit(1)
  }
  console.log(`프로젝트 로드: ${existing.name}`)
  if (existing.aiScheduleEstimate) {
    console.log('기존 aiScheduleEstimate 존재 — 덮어씀')
  }

  await prisma.project.update({
    where: { id: SANGBONG_ID },
    data: { aiScheduleEstimate: estimate },
  })
  console.log(`✅ 저장 완료: ${estimate.totalDuration}일 (${estimate.rangeMin}~${estimate.rangeMax}일)`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
