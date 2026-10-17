import QRCode from 'qrcode'

export interface TicketItem {
  name: string
  quantity: number
  quantityRedeemed?: number
  unitPrice: number
}

export interface TicketData {
  orderId: string
  tenantSlug: string
  nightclubName: string
  customerName: string
  customerDni: string
  items: TicketItem[]
  totalAmount: number
  expiresAt: string
  qrToken: string
}

export interface SavedTicket extends TicketData {
  createdAt: string
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED'
  ticketDataUrl?: string
}

/**
 * Genera el código QR de alto contraste en formato DataURL.
 * Usa nivel 'L' (7% corrección para pantallas digitales) que genera los bloques más grandes posibles
 * para permitir detección instantánea desde 1 a 2 metros de distancia estilo Mercado Pago.
 */
export async function generateQrDataUrl(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: 'L',
    margin: 2,
    width: 640,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}

/**
 * Renderiza el ticket completo de consumo en un HTML5 Canvas de alta resolución (750x1250)
 * y retorna la imagen en base64 PNG lista para descargar a la galería de fotos.
 */
export async function renderTicketToCanvas(ticket: TicketData): Promise<string> {
  if (typeof window === 'undefined') return ''

  const qrDataUrl = await generateQrDataUrl(ticket.qrToken)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo inicializar el contexto 2D de Canvas')

  // Dimensiones HD optimizadas para pantallas de celular
  const width = 750
  const height = 1260
  canvas.width = width
  canvas.height = height

  // 1. Fondo degradado noche
  const bgGrad = ctx.createLinearGradient(0, 0, width, height)
  bgGrad.addColorStop(0, '#0a0a10')
  bgGrad.addColorStop(0.5, '#120f24')
  bgGrad.addColorStop(1, '#0c0a14')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // Borde neón exterior
  ctx.strokeStyle = '#8b5cf6'
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, width - 36, height - 36)

  // 2. Cabecera del Boliche
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(ticket.nightclubName.toUpperCase(), width / 2, 85)

  ctx.fillStyle = '#c084fc'
  ctx.font = '600 20px sans-serif'
  ctx.fillText('BARRA ONLINE • TICKET DE CONSUMICIÓN', width / 2, 120)

  // Línea divisoria
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(50, 145)
  ctx.lineTo(width - 50, 145)
  ctx.stroke()

  // 3. Cuadro de Datos del Comprador
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.fillRect(50, 165, width - 100, 120)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.strokeRect(50, 165, width - 100, 120)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px sans-serif'
  ctx.fillText('TITULAR:', 75, 205)
  ctx.fillText('DNI ASOCIADO:', 75, 245)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(ticket.customerName.toUpperCase(), 250, 205)
  ctx.fillText(ticket.customerDni, 250, 245)

  // 4. Detalle de Bebidas
  ctx.fillStyle = '#e2e8f0'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('DETALLE DEL PEDIDO:', 50, 325)

  let yPos = 365
  ctx.font = '20px sans-serif'

  for (const item of ticket.items) {
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${item.quantity}x ${item.name}`, 60, yPos)

    const priceText = `$${(item.unitPrice * item.quantity).toLocaleString('es-AR')}`
    ctx.fillStyle = '#c084fc'
    ctx.textAlign = 'right'
    ctx.fillText(priceText, width - 60, yPos)
    ctx.textAlign = 'left'

    yPos += 38
  }

  // Total
  yPos += 15
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.beginPath()
  ctx.moveTo(50, yPos)
  ctx.lineTo(width - 50, yPos)
  ctx.stroke()

  yPos += 45
  ctx.font = 'bold 26px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('TOTAL ABONADO:', 50, yPos)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#34d399'
  ctx.fillText(`$${ticket.totalAmount.toLocaleString('es-AR')}`, width - 50, yPos)
  ctx.textAlign = 'center'

  // 5. Contenedor del Código QR (Blanco de Alto Contraste)
  const qrBoxY = yPos + 35
  const qrBoxSize = 460
  const qrBoxX = (width - qrBoxSize) / 2

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize)
  ctx.strokeStyle = '#8b5cf6'
  ctx.lineWidth = 4
  ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize)

  // Cargar imagen QR sobre el canvas
  const qrImg = new Image()
  qrImg.src = qrDataUrl
  await new Promise((resolve) => {
    qrImg.onload = resolve
  })

  const qrMargin = 20
  ctx.drawImage(
    qrImg,
    qrBoxX + qrMargin,
    qrBoxY + qrMargin,
    qrBoxSize - qrMargin * 2,
    qrBoxSize - qrMargin * 2
  )

  // 6. Pie de Seguridad y Validez
  const footerY = qrBoxY + qrBoxSize + 40
  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(`VÁLIDO HASTA LAS 07:00 AM • CANJE REUTILIZABLE EN BARRA`, width / 2, footerY)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.font = '16px monospace'
  ctx.fillText(`ORDEN: ${ticket.orderId.toUpperCase()}`, width / 2, footerY + 30)

  ctx.font = '14px sans-serif'
  ctx.fillText(
    'Firma digital HMAC-SHA256 • Presentar este ticket en barra con o sin internet.',
    width / 2,
    footerY + 55
  )

  return canvas.toDataURL('image/png')
}

/**
 * Dispara la descarga directa del archivo PNG en el navegador.
 */
export function triggerDirectDownload(dataUrl: string, filename: string): void {
  if (typeof window === 'undefined') return
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Comparte o guarda en fotos mediante la Web Share API nativa (iOS y Android).
 */
export async function shareTicketNative(
  dataUrl: string,
  title: string,
  text: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.share) return false

  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], 'ticket-barra.png', { type: 'image/png' })

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title,
        text,
      })
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Persistencia de tickets en localStorage para acceso 100% offline.
 */
export function saveTicketLocally(tenantSlug: string, ticket: SavedTicket): void {
  if (typeof window === 'undefined') return
  try {
    const key = `bo_tickets_${tenantSlug}`
    const existingRaw = localStorage.getItem(key)
    const tickets: SavedTicket[] = existingRaw ? JSON.parse(existingRaw) : []

    const filtered = tickets.filter((t) => t.orderId !== ticket.orderId)
    filtered.unshift(ticket)

    localStorage.setItem(key, JSON.stringify(filtered))
  } catch (err) {
    console.warn('Error guardando ticket offline:', err)
  }
}

export function getSavedTickets(tenantSlug: string): SavedTicket[] {
  if (typeof window === 'undefined') return []
  try {
    const key = `bo_tickets_${tenantSlug}`
    const existingRaw = localStorage.getItem(key)
    return existingRaw ? JSON.parse(existingRaw) : []
  } catch {
    return []
  }
}
