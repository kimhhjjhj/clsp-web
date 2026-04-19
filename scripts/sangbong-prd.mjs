import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const p = await prisma.project.findFirst({ where: { OR: [{ name: { contains: '상봉' } }, { name: { contains: '삼정' } }] } })
if (!p) { console.error('상봉동 없음'); process.exit(1) }
const upd = await prisma.project.update({ where: { id: p.id }, data: { prdCount: 20 } })
console.log('prdCount:', upd.prdCount)
await prisma.$disconnect()
