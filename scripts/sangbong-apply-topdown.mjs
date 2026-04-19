import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const where = { OR: [{ name: { contains: '상봉' } }, { name: { contains: '삼정' } }] }
const project = await prisma.project.findFirst({ where })
if (!project) { console.error('상봉동 프로젝트 없음'); process.exit(1) }

console.log('Before:', JSON.stringify({
  id: project.id, name: project.name,
  ground: project.ground, basement: project.basement, lowrise: project.lowrise,
  bldgArea: project.bldgArea, buildingArea: project.buildingArea, siteArea: project.siteArea,
  sitePerim: project.sitePerim, bldgPerim: project.bldgPerim,
  wtBottom: project.wtBottom, waBottom: project.waBottom,
}, null, 2))

// 상봉동 기본값 (사용자 확인 후 /edit 에서 더 정확히 조정 가능)
const updated = await prisma.project.update({
  where: { id: project.id },
  data: {
    constructionMethod: 'semi_top_down',
    // 누락된 규모 변수 — 실측 없어서 공기 산정용 기본값. 정확한 값은 UI에서 수정
    bldgArea:     project.bldgArea     ?? 30000,
    buildingArea: project.buildingArea ?? 1500,
    siteArea:     project.siteArea     ?? 3000,
    sitePerim:    project.sitePerim    ?? 220,
    bldgPerim:    project.bldgPerim    ?? 160,
    wtBottom:     project.wtBottom     ?? 3,
    waBottom:     project.waBottom     ?? 9,  // 지하 4층 → 15m 굴착 중 풍화토 3 + 풍화암 6 = 9m까지
  },
})
console.log('After :', JSON.stringify({
  constructionMethod: updated.constructionMethod,
  bldgArea: updated.bldgArea, buildingArea: updated.buildingArea, siteArea: updated.siteArea,
  sitePerim: updated.sitePerim, bldgPerim: updated.bldgPerim,
  wtBottom: updated.wtBottom, waBottom: updated.waBottom,
}, null, 2))

// generateWBS 호출해서 즉시 미리보기
const { generateWBS } = await import('../lib/engine/wbs.ts').catch(() => ({ generateWBS: null }))
if (generateWBS) {
  const tasks = generateWBS({
    name: updated.name,
    ground: updated.ground ?? 0,
    basement: updated.basement ?? 0,
    lowrise: updated.lowrise ?? 0,
    hasTransfer: updated.hasTransfer,
    sitePerim: updated.sitePerim ?? undefined,
    bldgPerim: updated.bldgPerim ?? undefined,
    siteArea: updated.siteArea ?? undefined,
    bldgArea: updated.bldgArea ?? undefined,
    buildingArea: updated.buildingArea ?? undefined,
    wtBottom: updated.wtBottom ?? undefined,
    waBottom: updated.waBottom ?? undefined,
    constructionMethod: 'semi_top_down',
    prdCount: 20,
    mode: 'cp',
  })
  console.log(`\n생성된 WBS ${tasks.length}개 공종 · 총 duration ${tasks.reduce((s,t)=>s+t.duration,0).toFixed(1)}일`)
  for (const t of tasks) {
    console.log(`  ${(t.wbsCode ?? '').padEnd(8)} ${t.name.padEnd(24)} ${String(t.quantity).padStart(8)} ${(t.unit ?? '').padEnd(4)} = ${t.duration.toFixed(1)}일`)
  }
}
await prisma.$disconnect()
