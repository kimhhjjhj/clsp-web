import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const projects = await prisma.project.findMany({
  where: { OR: [{ name: { contains: '상봉' } }, { name: { contains: '삼정' } }] },
  select: {
    id: true, name: true, type: true, ground: true, basement: true, lowrise: true,
    hasTransfer: true, bldgArea: true, buildingArea: true, siteArea: true,
    sitePerim: true, bldgPerim: true, wtBottom: true, waBottom: true, startDate: true,
  },
})
for (const p of projects) console.log(JSON.stringify(p, null, 2))
await prisma.$disconnect()
