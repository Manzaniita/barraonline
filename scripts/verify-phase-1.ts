import { generateOrderQrToken, verifyOrderQrToken, hashQrToken } from '../src/lib/crypto'
import { prisma } from '../src/lib/prisma'

async function runPhase1Verification() {
  console.log('🧪 Iniciando verificación automatizada de FASE 1...')

  // 1. Verificar Prisma Client y Modelos
  console.log('\n--- 1. Verificando Tipos y Modelos de Prisma ---')
  if (!prisma.tenant || !prisma.user || !prisma.product || !prisma.order || !prisma.orderItem || !prisma.redemptionLog) {
    throw new Error('❌ Faltan modelos requeridos en Prisma Client')
  }
  console.log('✅ Modelos de Prisma verificados: Tenant, User, Product, Order, OrderItem, RedemptionLog.')

  // 2. Generación y Validación de Token QR Válido
  console.log('\n--- 2. Verificando Generación y Validación de Token QR ---')
  const validPayload = {
    orderId: 'c8a329fa-47cb-4b35-8ea5-6ec21c17822a',
    tenantId: '12fae490-e35f-4028-a42e-68e515dbe367',
    userDni: '40123456',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(), // Vence en 12 horas
  }

  const { token, tokenHash } = generateOrderQrToken(validPayload)
  console.log('Token generado (primeros 35 chars):', token.slice(0, 35) + '...')
  console.log('Hash SHA-256 indexable:', tokenHash)

  const verification = verifyOrderQrToken(token)
  if (!verification.valid || !verification.payload) {
    throw new Error(`❌ Falló la verificación de un token válido: ${verification.error}`)
  }

  if (
    verification.payload.orderId !== validPayload.orderId ||
    verification.payload.tenantId !== validPayload.tenantId ||
    verification.payload.userDni !== validPayload.userDni
  ) {
    throw new Error('❌ El payload recuperado no coincide con el payload original')
  }
  console.log('✅ Token válido verificado correctamente con integridad de datos garantizada.')

  // 3. Verificación de Hash Idempotente
  console.log('\n--- 3. Verificando Idempotencia de Hash ---')
  const recalculatedHash = hashQrToken(token)
  if (recalculatedHash !== tokenHash) {
    throw new Error('❌ El hash del token no es determinístico')
  }
  console.log('✅ Hash determinístico e idempotente verificado.')

  // 4. Protección contra Tokens Falsificados / Alterados
  console.log('\n--- 4. Verificando Detección de Tokens Alterados ---')
  const [encodedPayload, signature] = token.split('.')

  // Payload alterado con la misma firma
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...validPayload, userDni: '99999999' })
  ).toString('base64url')
  const tamperedToken1 = `${tamperedPayload}.${signature}`

  const resultTampered1 = verifyOrderQrToken(tamperedToken1)
  if (resultTampered1.valid || resultTampered1.error !== 'INVALID_SIGNATURE') {
    throw new Error('❌ El sistema no rechazó un payload alterado')
  }
  console.log('✅ Rechazo confirmado para payload alterado (INVALID_SIGNATURE).')

  // Firma alterada
  const tamperedSignature = signature.slice(0, -4) + 'abcd'
  const tamperedToken2 = `${encodedPayload}.${tamperedSignature}`

  const resultTampered2 = verifyOrderQrToken(tamperedToken2)
  if (resultTampered2.valid || resultTampered2.error !== 'INVALID_SIGNATURE') {
    throw new Error('❌ El sistema no rechazó una firma alterada')
  }
  console.log('✅ Rechazo confirmado para firma alterada (INVALID_SIGNATURE).')

  // Token malformado
  const resultMalformed = verifyOrderQrToken('token-invalido-sin-punto')
  if (resultMalformed.valid || resultMalformed.error !== 'MALFORMED_TOKEN') {
    throw new Error('❌ El sistema no detectó formato inválido')
  }
  console.log('✅ Rechazo confirmado para token malformado (MALFORMED_TOKEN).')

  // 5. Expiración de Tokens
  console.log('\n--- 5. Verificando Rechazo de Tokens Expirados ---')
  const expiredPayload = {
    orderId: 'c8a329fa-47cb-4b35-8ea5-6ec21c17822a',
    tenantId: '12fae490-e35f-4028-a42e-68e515dbe367',
    expiresAt: new Date(Date.now() - 1000 * 60).toISOString(), // Expiró hace 1 minuto
  }

  const { token: expiredToken } = generateOrderQrToken(expiredPayload)
  const resultExpired = verifyOrderQrToken(expiredToken)
  if (resultExpired.valid || resultExpired.error !== 'EXPIRED_TOKEN') {
    throw new Error('❌ El sistema no rechazó un token expirado')
  }
  console.log('✅ Rechazo confirmado para token expirado (EXPIRED_TOKEN).')

  console.log('\n🎉 ¡TODOS LOS TESTS DE LA FASE 1 PASARON AL 100%! 🚀\n')
}

runPhase1Verification()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
