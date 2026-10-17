import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const startTime = Date.now()
    // Ejecuta una consulta ligera para verificar conectividad
    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - startTime

    // Intentar contar tenants si las tablas ya existen
    let tenantCount: number | null = null
    let tablesStatus = 'no_creadas'
    try {
      tenantCount = await prisma.tenant.count()
      tablesStatus = 'tablas_listas'
    } catch {
      tablesStatus = 'tablas_pendientes_de_crear'
    }

    return NextResponse.json({
      status: 'online',
      database: 'conectada',
      latencyMs: latency,
      tables: tablesStatus,
      tenantCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        status: 'online',
        database: 'desconectada_o_error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
