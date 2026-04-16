import { PrismaClient } from '@prisma/client'

// Turbopack 환경에서 env() 검증 전 환경변수 직접 주입
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres.fvfyirsmvgorhmpaswux:dksltlqkf1%40@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = 'postgresql://postgres.fvfyirsmvgorhmpaswux:dksltlqkf1%40@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
