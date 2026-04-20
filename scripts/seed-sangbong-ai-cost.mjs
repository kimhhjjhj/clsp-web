// 상봉동 역세권 청년주택 AI 공사비 추정 — Claude Opus 4.7 큐레이션
//
// 프로젝트 조건:
//   공동주택 · 지상20/지하4/저층부3 · 전이층 · 연면적 17,360㎡
//   대지둘레 160m · 건물둘레 150m
//   Semi Top-down (CWS) · PRD 20공
//   풍화토 7.1m · 풍화암 16.8m (깊은 굴착)
//   서울 상봉동 · 2022-01-15 착공
//
// 산출 근거:
//   연면적 17,360㎡ = 약 5,253평
//   역세권 청년주택 평당 단가 (2022~2024 기준): 480~580만원/평
//   Semi TD + 풍화암 16.8m + 전이층 + PRD 감안 → 533만원/평
//   총 공사비 = 5,253 × 533 = 약 28,000,000만원 = 280억
//
// 공종 비율 (깊은 굴착 현장 실무가이드 p.142~):
//   토공 3% · 흙막이 7% · 철콘 28% · 마감 34%
//   기계 10% · 전기 8% · 조경 3% · 가설 4% · Semi TD 특화 3%

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const aiCostEstimate = {
  totalAmount: 2_803_600,         // 만원 (280.36억 = 5,253평 × 533만원)
  unitPrice: 533,                 // 만원/평
  rangeMin: 2_650_000,            // 265억
  rangeMax: 3_050_000,            // 305억
  confidence: 'medium',
  estimator: 'Claude Opus 4.7',
  estimatedAt: new Date().toISOString().slice(0, 10),
  trades: [
    {
      category: '토공사',
      amount: 84_000,
      pctOfTotal: 3,
      note: '풍화암 16.8m 포함 터파기 · 풍화토 7.1m + 풍화암 9.7m · 발파 일부 포함',
    },
    {
      category: '흙막이',
      amount: 196_000,
      pctOfTotal: 7,
      note: 'CIP(H-BEAM + 철근망) + 캠빔 + 스트럿 · 깊은 굴착 평균 대비 +2%p',
    },
    {
      category: '철근콘크리트',
      amount: 785_000,
      pctOfTotal: 28,
      note: '지상 20개층 + 지하 4개층 + 전이층 · Semi TD 역타 포함 · CWS 수직재 + 바닥판',
    },
    {
      category: '마감공사',
      amount: 953_000,
      pctOfTotal: 34,
      note: '공동주택 인테리어 기본 + 외벽 석재·판넬 · 청년주택 기본 수준',
    },
    {
      category: '기계설비',
      amount: 280_000,
      pctOfTotal: 10,
      note: '급수·급탕·오배수·난방·환기 · 공동주택 표준',
    },
    {
      category: '전기·통신',
      amount: 224_000,
      pctOfTotal: 8,
      note: '수변전·케이블·통신·소방전기 · 옥탑 기계실 포함',
    },
    {
      category: '조경·부대토목',
      amount: 84_000,
      pctOfTotal: 3,
      note: '대지 1,440㎡ 소규모 · 포장·식재·부대시설',
    },
    {
      category: '가설공사',
      amount: 112_000,
      pctOfTotal: 4,
      note: '가설울타리 160m · 타워크레인 2기 · 호이스트 · 가설사무실 8개소',
    },
    {
      category: 'Semi TD·PRD 특화',
      amount: 85_600,
      pctOfTotal: 3,
      note: 'PRD 20공 (천공 1~1.5공/일 + 설치·해체 각 5일) + CWS 가설 자재 + 상부 선행 가설',
    },
  ],
  rationale: `연면적 17,360㎡ (≈5,253평) 공동주택, 서울 역세권 청년주택으로 평당 단가 533만원/평 적용 → 총 280.36억원.

평당 단가 산출: 기본 청년주택 480만원/평 + Semi Top-down 공법 프리미엄 +30만원 + 풍화암 16.8m 깊은 굴착 +15만원 + 전이층 +8만원 ≈ 533만원/평. 2022년 착공 시점 기준이며 자재비 상승 감안 시 265~305억 밴드.

공종 비율 특징:
· 흙막이 7%는 일반 공동주택(4~5%) 대비 높음 — 풍화암 9.7m 깊은 구간과 Semi TD CIP 특화 때문
· Semi TD·PRD 특화 3%는 일반 Bottom-up에선 없는 항목 — CWS 수직재·PRD 20공·상부 선행 가설 별도 계상
· 마감 34%·철콘 28%는 공동주택 표준 비율 유지

신뢰도 보통(medium): 상봉동 청년주택 실적 추정치이므로 실제 계약·변경 계약 반영 시 ±5~8% 편차 가능. CPM 기반 WBS 물량 × 단가 방식과 교차 검증 권장.`,
}

const project = await prisma.project.findFirst({
  where: { name: { contains: '상봉' } },
  select: { id: true, name: true, bldgArea: true },
})

if (!project) {
  console.error('상봉동 프로젝트를 찾을 수 없음')
  process.exit(1)
}

console.log(`대상: ${project.name} (${project.id})`)
console.log(`연면적: ${project.bldgArea}㎡`)
console.log(`총 공사비: ${aiCostEstimate.totalAmount.toLocaleString()}만원 (${(aiCostEstimate.totalAmount / 10000).toFixed(1)}억)`)
console.log(`평당 단가: ${aiCostEstimate.unitPrice}만원/평`)
console.log(`공종 개수: ${aiCostEstimate.trades.length}개`)
console.log(`합계 검증: ${aiCostEstimate.trades.reduce((s, t) => s + t.amount, 0).toLocaleString()}만원`)

await prisma.project.update({
  where: { id: project.id },
  data: { aiCostEstimate },
})

console.log('✔ DB 업데이트 완료')
await prisma.$disconnect()
