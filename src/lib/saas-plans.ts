import { prisma } from './prisma'

export interface SaasPlanConfig {
  id: string
  name: string
  description: string
  feePercentage: number
  monthlyPrice: number
  maxProducts: number // 0 = ilimitado
  maxStaff: number // 0 = ilimitado
  isActive: boolean
  sortOrder: number
  updatedAt?: string
}

const DEFAULT_INITIAL_PLANS: SaasPlanConfig[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    description: 'Ideal para bares y eventos pequeños con carta reducida.',
    feePercentage: 7.0,
    monthlyPrice: 0,
    maxProducts: 25,
    maxStaff: 5,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'PRO',
    name: 'Pro',
    description: 'Para boliches y discotecas con operación nocturna completa.',
    feePercentage: 5.0,
    monthlyPrice: 45000,
    maxProducts: 100,
    maxStaff: 25,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Grandes complejos, festivales y múltiples barras sin límites.',
    feePercentage: 3.0,
    monthlyPrice: 95000,
    maxProducts: 0,
    maxStaff: 0,
    isActive: true,
    sortOrder: 3,
  },
]

let tableEnsured = false

async function ensureSaasPlanTable() {
  if (tableEnsured) return
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SaasPlan" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "feePercentage" NUMERIC(5,2) NOT NULL DEFAULT 5.0,
        "monthlyPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "maxProducts" INTEGER NOT NULL DEFAULT 0,
        "maxStaff" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int as count FROM "SaasPlan"`
    )
    const count = Number(countRows?.[0]?.count ?? 0)

    if (count === 0) {
      for (const plan of DEFAULT_INITIAL_PLANS) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "SaasPlan" ("id", "name", "description", "feePercentage", "monthlyPrice", "maxProducts", "maxStaff", "isActive", "sortOrder", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT ("id") DO NOTHING`,
          plan.id,
          plan.name,
          plan.description,
          plan.feePercentage,
          plan.monthlyPrice,
          plan.maxProducts,
          plan.maxStaff,
          plan.isActive,
          plan.sortOrder
        )
      }
    }

    tableEnsured = true
  } catch (err) {
    console.error('[saas-plans] Error asegurando tabla SaasPlan:', err)
  }
}

function mapRowToPlan(row: any): SaasPlanConfig {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ''),
    feePercentage: Number(row.feePercentage ?? 0),
    monthlyPrice: Number(row.monthlyPrice ?? 0),
    maxProducts: Number(row.maxProducts ?? 0),
    maxStaff: Number(row.maxStaff ?? 0),
    isActive: Boolean(row.isActive ?? true),
    sortOrder: Number(row.sortOrder ?? 0),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  }
}

export async function getAllSaasPlans(): Promise<SaasPlanConfig[]> {
  await ensureSaasPlanTable()
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SaasPlan" ORDER BY "sortOrder" ASC, "createdAt" ASC NULLS LAST, "id" ASC`
    ).catch(async () => {
      return prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "SaasPlan" ORDER BY "sortOrder" ASC, "id" ASC`
      )
    })
    return rows.map(mapRowToPlan)
  } catch (err) {
    console.error('[getAllSaasPlans] Error:', err)
    return DEFAULT_INITIAL_PLANS
  }
}

export async function getSaasPlanById(planId: string): Promise<SaasPlanConfig | null> {
  await ensureSaasPlanTable()
  try {
    const cleanId = planId.trim().toUpperCase()
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SaasPlan" WHERE UPPER("id") = $1 LIMIT 1`,
      cleanId
    )
    if (rows && rows.length > 0) {
      return mapRowToPlan(rows[0])
    }
    return null
  } catch (err) {
    console.error('[getSaasPlanById] Error:', err)
    return null
  }
}

export async function upsertSaasPlan(input: {
  id: string
  name: string
  description?: string
  feePercentage: number
  monthlyPrice: number
  maxProducts: number
  maxStaff: number
  isActive?: boolean
  sortOrder?: number
}): Promise<SaasPlanConfig> {
  await ensureSaasPlanTable()
  const cleanId = input.id
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')

  if (!cleanId) {
    throw new Error('El código del plan es obligatorio.')
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error('El nombre del plan es obligatorio.')
  }

  const description = (input.description || '').trim()
  const feePercentage = Math.max(0, Math.min(100, Number(input.feePercentage) || 0))
  const monthlyPrice = Math.max(0, Number(input.monthlyPrice) || 0)
  const maxProducts = Math.max(0, Math.floor(Number(input.maxProducts) || 0))
  const maxStaff = Math.max(0, Math.floor(Number(input.maxStaff) || 0))
  const isActive = input.isActive !== undefined ? Boolean(input.isActive) : true
  const sortOrder = Number(input.sortOrder ?? 10)

  await prisma.$executeRawUnsafe(
    `INSERT INTO "SaasPlan" ("id", "name", "description", "feePercentage", "monthlyPrice", "maxProducts", "maxStaff", "isActive", "sortOrder", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT ("id") DO UPDATE SET
       "name" = EXCLUDED."name",
       "description" = EXCLUDED."description",
       "feePercentage" = EXCLUDED."feePercentage",
       "monthlyPrice" = EXCLUDED."monthlyPrice",
       "maxProducts" = EXCLUDED."maxProducts",
       "maxStaff" = EXCLUDED."maxStaff",
       "isActive" = EXCLUDED."isActive",
       "sortOrder" = EXCLUDED."sortOrder",
       "updatedAt" = NOW()`,
    cleanId,
    name,
    description,
    feePercentage,
    monthlyPrice,
    maxProducts,
    maxStaff,
    isActive,
    sortOrder
  )

  const saved = await getSaasPlanById(cleanId)
  if (!saved) {
    throw new Error('No se pudo recuperar el plan guardado.')
  }
  return saved
}

export async function deleteSaasPlan(planId: string): Promise<void> {
  await ensureSaasPlanTable()
  const cleanId = planId.trim().toUpperCase()
  await prisma.$executeRawUnsafe(`DELETE FROM "SaasPlan" WHERE UPPER("id") = $1`, cleanId)
}
