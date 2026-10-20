import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      {
        status: 'online',
        database: 'conectada',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[GET /api/health] Database error:', error)
    return NextResponse.json(
      {
        status: 'unavailable',
        database: 'desconectada_o_error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
