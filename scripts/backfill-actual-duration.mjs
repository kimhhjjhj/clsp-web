// actualDuration drift (startDate·actualCompletionDate 로 재계산한 값과 다른 경우) 수정
// 실행: node scripts/backfill-actual-duration.mjs [--apply]

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

const rows = await prisma.project.findMany({
  where: { actualDuration: { not: null } },
  select: { id: true, name: true, startDate: true, actualCompletionDate: true, actualDuration: true },
})

const fixes = []
for (const p of rows) {
  if (!p.startDate || !p.actualCompletionDate) continue
  const s = new Date(p.startDate)
  const e = new Date(p.actualCompletionDate)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) continue
  const recomputed = Math.round((e - s) / 86400000)
  if (recomputed <= 0) continue
  if (recomputed === p.actualDuration) continue
  fixes.push({ id: p.id, name: p.name, was: p.actualDuration, fixed: recomputed })
}

console.log(`drift 프로젝트 ${fixes.length}건 / 전체 ${rows.length}건`)
for (const f of fixes) {
  console.log(`  ${f.name}: ${f.was} → ${f.fixed} (drift ${f.was - f.fixed})`)
}

if (APPLY && fixes.length > 0) {
  for (const f of fixes) {
    await prisma.project.update({ where: { id: f.id }, data: { actualDuration: f.fixed } })
  }
  console.log(`✔ ${fixes.length}건 적용 완료`)
} else if (fixes.length > 0) {
  console.log('\n(dry-run) --apply 플래그 없어 수정은 건너뜀')
}

await prisma.$disconnect()
