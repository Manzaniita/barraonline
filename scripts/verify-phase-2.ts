import { detectInAppBrowser } from '../src/lib/browser-detection'
import { isValidDni, isValidFullName } from '../src/lib/customer-session'
import { getTenantAndCatalog } from '../src/lib/catalog-service'

async function runPhase2Verification() {
  console.log('🧪 Iniciando verificación automatizada de FASE 2...')

  // 1. Verificación de Detección de In-App Browsers
  console.log('\n--- 1. Verificando Detección de In-App Browsers ---')
  const instagramUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 294.0.0.27.110'
  const tiktokUA = 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.93 Mobile Safari/537.36 musical_ly_2022'
  const chromeUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

  const resInstagram = detectInAppBrowser(instagramUA)
  if (!resInstagram.isInApp || resInstagram.appType !== 'instagram') {
    throw new Error('❌ Falló detección de WebView de Instagram')
  }

  const resTikTok = detectInAppBrowser(tiktokUA)
  if (!resTikTok.isInApp || resTikTok.appType !== 'tiktok') {
    throw new Error('❌ Falló detección de WebView de TikTok')
  }

  const resChrome = detectInAppBrowser(chromeUA)
  if (resChrome.isInApp) {
    throw new Error('❌ Falso positivo: Chrome nativo marcado como In-App')
  }
  console.log('✅ Detección de Instagram, TikTok y Chrome estándar funcionando al 100%.')

  // 2. Verificación de Validación de DNI y Nombre Completo
  console.log('\n--- 2. Verificando Validación de DNI y Nombre ---')
  if (!isValidDni('42123456') || !isValidDni('95123456') || !isValidDni('8123456')) {
    throw new Error('❌ Falló validación de DNI legítimo')
  }
  if (isValidDni('123') || isValidDni('abcdefgh') || isValidDni('123456789012')) {
    throw new Error('❌ No rechazó DNI inválido')
  }

  if (!isValidFullName('Juan Pérez') || !isValidFullName('María Florencia Rossi')) {
    throw new Error('❌ Falló validación de nombre y apellido')
  }
  if (isValidFullName('Juan') || isValidFullName('A B')) {
    throw new Error('❌ No rechazó nombre incompleto')
  }
  console.log('✅ Validación de DNI (7-9 dígitos) y Nombre Completo (2+ palabras) aprobada.')

  // 3. Verificación de Catálogo White-Label
  console.log('\n--- 3. Verificando Catálogo White-Label & Promos ---')
  const catalog = await getTenantAndCatalog('demo-club')
  if (!catalog) {
    throw new Error('❌ No se pudo cargar el catálogo del demo-club')
  }

  if (catalog.products.length < 5) {
    throw new Error('❌ Catálogo incompleto, se esperaban más de 5 productos')
  }

  const promoProduct = catalog.products.find((p) => p.redeemDeadlineTime !== undefined && p.redeemDeadlineTime !== null)
  if (!promoProduct) {
    throw new Error('❌ Falta producto de prueba con horario límite de promo')
  }
  console.log(`✅ Catálogo con ${catalog.products.length} productos verificado.`)
  console.log(`✅ Producto promo con vencimiento detectado: "${promoProduct.name}" (Límite: ${promoProduct.redeemDeadlineTime}).`)

  console.log('\n🎉 ¡TODOS LOS TESTS DE LA FASE 2 PASARON EXITOSAMENTE! 🚀\n')
}

runPhase2Verification().catch((err) => {
  console.error(err)
  process.exit(1)
})
