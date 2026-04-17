import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const list = await p.project.findMany({
  select: {
    id: true, name: true,
    _count: { select: { dailyReports: true, productivityProposals: true } },
  },
})
for (const x of list) {
  console.log(`${x.id}  ${x.name}  일보=${x._count.dailyReports}  제안=${x._count.productivityProposals}`)
}
await p.$disconnect()
