import { generateOrderQrToken } from '../src/lib/crypto'
import { verifyQrForBar, redeemOrderItems, rollbackRecentRedemption, lookupOrdersByDni } from '../src/lib/bar-service'

async function runPhase5Verification() {
  console.log('🧪 Iniciando verificación automatizada de FASE 5...')

  // 1. Verificación de Lector y Validación de QR en Barra
  console.log('\n--- 1. Verificando Validación de QR para Pantalla de Barra ---')
  const orderId = 'ord-phase-5-bar-scan-001'
  const tenantId = 'tenant-demo-club'
  const userDni = '42123456'
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString()

  const { token: validToken } = generateOrderQrToken({
    orderId,
    tenantId,
    userDni,
    expiresAt,
  })

  const scanResult = await verifyQrForBar({
    qrToken: validToken,
    tenantSlug: 'demo-club',
  })

  if (!scanResult.valid || !scanResult.order) {
    throw new Error(`❌ Falló la verificación del QR en barra: ${scanResult.error}`)
  }
  console.log(`✅ QR verificado con éxito. Orden #${scanResult.order.orderId.slice(0, 8)} con ${scanResult.order.items.length} ítems disponibles.`)

  // Rechazo de QR con firma trucha
  const invalidToken = validToken.slice(0, -5) + '99999'
  const invalidResult = await verifyQrForBar({
    qrToken: invalidToken,
    tenantSlug: 'demo-club',
  })
  if (invalidResult.valid) {
    throw new Error('❌ La barra aceptó un QR con firma falsificada')
  }
  console.log('✅ QR falso o alterado rechazado correctamente por el lector de barra.')

  // 2. Restricción Dura de Seguridad: Prohibido Canjear sin QR firmado
  console.log('\n--- 2. Verificando Seguridad: Prohibido Canje sin QR Válido ---')
  const fakeRedeem = await redeemOrderItems({
    qrToken: 'token-invalido-sin-firma',
    tenantSlug: 'demo-club',
    deliveries: [{ orderItemId: 'item-1', quantity: 1 }],
  })

  if (fakeRedeem.success) {
    throw new Error('❌ Falló la regla de seguridad: se permitió canjear sin QR firmado')
  }
  console.log('✅ Intento de canje sin QR criptográfico bloqueado con éxito (403).')

  // 3. Verificación de Consulta por DNI (Estrictamente Solo Lectura)
  console.log('\n--- 3. Verificando Modo Consulta por DNI (Solo Lectura) ---')
  const dniLookup = await lookupOrdersByDni({
    dni: '42123456',
    tenantSlug: 'demo-club',
  })

  if (dniLookup.canRedeemFromDni !== false) {
    throw new Error('❌ La vista de DNI tiene habilitado el canje indebidamente')
  }
  console.log('✅ Consulta por DNI verificada con canje bloqueado al 100%.')
  console.log(`✅ Aviso de seguridad presente: "${dniLookup.securityNotice}"`)

  console.log('\n🎉 ¡TODOS LOS TESTS DE LA FASE 5 PASARON EXITOSAMENTE! 🚀\n')
}

runPhase5Verification().catch((err) => {
  console.error(err)
  process.exit(1)
})
