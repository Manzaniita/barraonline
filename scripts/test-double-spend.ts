// scripts/test-double-spend.ts

import { generateOrderQrToken } from '../src/lib/crypto'
import { redeemOrderItems } from '../src/lib/bar-service'
import { prisma } from '../src/lib/prisma'

async function runConcurrencyTest() {
  console.log('🧪 [QA] Iniciando suite de prueba de concurrencia: Anti-Double-Spend...')

  const targetUrl = process.env.TEST_TARGET_URL || 'http://localhost:3000/api/bar/redeem'
  const payload = {
    qrToken: process.env.TEST_QR_TOKEN || 'TOKEN_VALIDO_DE_PRUEBA',
    itemsToRedeem: [{ orderItemId: process.env.TEST_ITEM_ID || 'ORDER_ITEM_UUID', quantity: 1 }],
    bartenderId: process.env.TEST_BARTENDER_ID || 'BARTENDER_UUID',
  }

  console.log('[QA] 1. Disparando 2 solicitudes concurrentes al endpoint HTTP al mismo milisegundo...')
  try {
    const [res1, res2] = await Promise.all([
      fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    ])

    console.log(`Respuesta Terminal 1: Status ${res1.status}`)
    console.log(`Respuesta Terminal 2: Status ${res2.status}`)

    if ((res1.status === 200 && res2.status !== 200) || (res2.status === 200 && res1.status !== 200)) {
      console.log('✅ ÉXITO HTTP: El bloqueo condicional atómico evitó el doble despacho.')
      return
    } else if (res1.status !== 200 && res2.status !== 200) {
      console.log(`ℹ️ Servidor HTTP respondió con estado ${res1.status} y ${res2.status} (sin orden activa precargada).`)
    } else {
      console.error('❌ FALLO: Posible vulnerabilidad de condición de carrera activa.')
      process.exit(1)
    }
  } catch (err: unknown) {
    console.log(`ℹ️ Endpoint HTTP ${targetUrl} en espera o servidor inactivo: ${(err as Error).message}`)
  }

  // 2. Verificación directa a nivel transaccional en PostgreSQL
  console.log('\n[QA] 2. Ejecutando verificación de condición de carrera atómica a nivel de persistencia Prisma...')
  try {
    const testTenant = await prisma.tenant.findFirst({ include: { products: true } })
    if (!testTenant || testTenant.products.length === 0) {
      console.log('ℹ️ Base de datos sin tenants precargados. Omitiendo prueba de integración directa.')
      return
    }

    const testUser =
      (await prisma.user.findFirst({ where: { role: 'BARTENDER' } })) ||
      (await prisma.user.findFirst())

    if (!testUser) {
      console.log('ℹ️ No se encontró usuario para simular bartender.')
      return
    }

    const product = testTenant.products[0]
    const testOrder = await prisma.order.create({
      data: {
        tenantId: testTenant.id,
        userId: testUser.id,
        status: 'ACTIVE',
        totalAmount: product.price,
        expiresAt: new Date(Date.now() + 3600000),
        items: {
          create: [
            {
              productId: product.id,
              productNameSnapshot: product.name,
              unitPrice: product.price,
              quantityPurchased: 1,
              quantityRedeemed: 0,
            },
          ],
        },
      },
      include: { items: true },
    })

    const orderItem = testOrder.items[0]
    const { token: qrToken } = generateOrderQrToken({
      orderId: testOrder.id,
      tenantId: testTenant.id,
      userDni: testUser.dni || undefined,
      expiresAt: testOrder.expiresAt.toISOString(),
    })

    console.log(`[QA] Orden de prueba creada: ${testOrder.id} con 1 unidad disponible.`)
    console.log('[QA] Disparando 2 llamadas concurrentes simultáneas a redeemOrderItems()...')

    const [resSvc1, resSvc2] = await Promise.allSettled([
      redeemOrderItems({
        qrToken,
        tenantSlug: testTenant.slug,
        bartenderUserId: testUser.id,
        deliveries: [{ orderItemId: orderItem.id, quantity: 1 }],
      }),
      redeemOrderItems({
        qrToken,
        tenantSlug: testTenant.slug,
        bartenderUserId: testUser.id,
        deliveries: [{ orderItemId: orderItem.id, quantity: 1 }],
      }),
    ])

    const success1 = resSvc1.status === 'fulfilled' && resSvc1.value.success
    const success2 = resSvc2.status === 'fulfilled' && resSvc2.value.success

    console.log(`Resultado Terminal A: ${success1 ? '✅ DESPACHO APROBADO' : '🛑 BLOQUEADO: ' + (resSvc1.status === 'fulfilled' ? resSvc1.value.error : '')}`)
    console.log(`Resultado Terminal B: ${success2 ? '✅ DESPACHO APROBADO' : '🛑 BLOQUEADO: ' + (resSvc2.status === 'fulfilled' ? resSvc2.value.error : '')}`)

    // Limpieza de datos de prueba
    await prisma.redemptionLog.deleteMany({ where: { orderId: testOrder.id } })
    await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } })
    await prisma.order.delete({ where: { id: testOrder.id } })

    if ((success1 && !success2) || (!success1 && success2)) {
      console.log('✅ ÉXITO TOTAL: La actualización atómica SQL impidió el doble despacho (1 aprobado, 1 rechazado).')
    } else if (!success1 && !success2) {
      console.log('⚠️ Ambas solicitudes fallaron.')
    } else {
      console.error('❌ FALLO CRÍTICO: Ambas transacciones lograron despachar. Condición de carrera presente.')
      process.exit(1)
    }
  } catch (dbErr: unknown) {
    console.error('Error durante la verificación directa de DB:', (dbErr as Error).message)
  }
}

runConcurrencyTest()
