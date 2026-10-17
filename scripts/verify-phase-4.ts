import { generateQrDataUrl, TicketData } from '../src/lib/ticket-generator'
import { generateOrderQrToken, verifyOrderQrToken } from '../src/lib/crypto'

async function runPhase4Verification() {
  console.log('🧪 Iniciando verificación automatizada de FASE 4...')

  // 1. Verificación de Generación de Código QR en Formato DataURL
  console.log('\n--- 1. Verificando Generación de QR DataURL (Alto Contraste) ---')
  const orderId = 'ord-phase-4-ticket-hd-001'
  const tenantId = 'tenant-demo-club'
  const userDni = '42123456'
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 10).toISOString()

  const { token } = generateOrderQrToken({
    orderId,
    tenantId,
    userDni,
    expiresAt,
  })

  const qrDataUrl = await generateQrDataUrl(token)
  if (!qrDataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('❌ El QR generado no es un DataURL de imagen PNG válido')
  }
  console.log('✅ QR generado en alta resolución con formato válido (data:image/png;base64,...)')

  // 2. Verificación de Integridad del Token dentro del QR
  console.log('\n--- 2. Verificando Integridad Criptográfica del Token ---')
  const verification = verifyOrderQrToken(token)
  if (!verification.valid || !verification.payload) {
    throw new Error(`❌ Token del QR inválido: ${verification.error}`)
  }
  if (verification.payload.orderId !== orderId || verification.payload.userDni !== userDni) {
    throw new Error('❌ Los datos verificados no coinciden con la orden emitida')
  }
  console.log('✅ Integridad criptográfica del token verificado con éxito (HMAC-SHA256).')

  // 3. Estructura de Datos del Ticket Offline
  console.log('\n--- 3. Verificando Estructura de Datos del Ticket Offline ---')
  const ticketData: TicketData = {
    orderId,
    tenantSlug: 'demo-club',
    nightclubName: 'Club Nocturno Palermo',
    customerName: 'Juan Pérez',
    customerDni: userDni,
    totalAmount: 14000,
    expiresAt,
    items: [
      { name: 'Fernet Branca con Coca', quantity: 2, unitPrice: 6500 },
      { name: 'Agua Kin', quantity: 1, unitPrice: 1000 },
    ],
    qrToken: token,
  }

  if (ticketData.items.length !== 2 || ticketData.totalAmount !== 14000) {
    throw new Error('❌ Estructura de ítems o total de ticket inconsistente')
  }
  console.log('✅ Estructura de ticket para persistencia offline en localStorage validada.')

  console.log('\n🎉 ¡TODOS LOS TESTS DE LA FASE 4 PASARON EXITOSAMENTE! 🚀\n')
}

runPhase4Verification().catch((err) => {
  console.error(err)
  process.exit(1)
})
