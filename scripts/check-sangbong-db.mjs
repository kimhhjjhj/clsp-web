import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const rows = await prisma.project.findMany({
  where: { OR: [{ name: { contains: '상봉' } }, { location: { contains: '상봉' } }] },
  select: {
    id: true, name: true, startDate: true,
    actualCompletionDate: true, actualDuration: true,
    lastCpmDuration: true, ground: true, basement: true,
    bldgArea: true, constructionMethod: true,
  },
})

for (const p of rows) {
  const s = p.startDate ? new Date(p.startDate) : null
  const e = p.actualCompletionDate ? new Date(p.actualCompletionDate) : null
  const recomputed = s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())
    ? Math.round((e - s) / 86400000)
    : null
  console.log({
    id: p.id, name: p.name,
    startDate: p.startDate,
    actualCompletionDate: p.actualCompletionDate,
    actualDuration_DB: p.actualDuration,
    recomputed_from_dates: recomputed,
    drift: p.actualDuration != null && recomputed != null ? p.actualDuration - recomputed : null,
    lastCpmDuration: p.lastCpmDuration,
    ground: p.ground, basement: p.basement,
    bldgArea: p.bldgArea, constructionMethod: p.constructionMethod,
  })
}
await prisma.$disconnect()
