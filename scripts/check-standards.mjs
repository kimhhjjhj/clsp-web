import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const s = await p.companyStandardProductivity.findMany()
const all = await p.productivityProposal.findMany({
  select: { trade: true, value: true, unit: true, status: true, sampleSize: true, source: true },
  orderBy: [{ unit: 'asc' }, { trade: 'asc' }],
})
console.log('━ CompanyStandardProductivity ━')
console.log(s)
console.log(`\n━ Proposals (${all.length}) ━`)
for (const r of all) {
  const src = r.source || {}
  console.log(`${r.status.padEnd(10)} ${r.trade.padEnd(20)} ${String(r.value).padStart(8)} ${r.unit.padEnd(14)} sample=${r.sampleSize}  proj=${src.projectName ?? ''}`)
}
await p.$disconnect()
