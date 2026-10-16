/**
 * Utilidades para detección de navegadores embebidos (WebViews)
 * de redes sociales como Instagram, TikTok, Facebook, etc.
 * Estas WebViews suelen bloquear Google OAuth con error 403 (disallowed_useragent).
 */

export interface InAppBrowserInfo {
  isInApp: boolean
  appType: 'instagram' | 'tiktok' | 'facebook' | 'whatsapp' | 'other' | null
}

export function detectInAppBrowser(userAgentString?: string): InAppBrowserInfo {
  if (typeof window === 'undefined' && !userAgentString) {
    return { isInApp: false, appType: null }
  }

  const ua = (userAgentString || (typeof window !== 'undefined' ? window.navigator.userAgent : '')).toLowerCase()

  if (ua.includes('instagram')) {
    return { isInApp: true, appType: 'instagram' }
  }
  if (ua.includes('tiktok') || ua.includes('musical_ly')) {
    return { isInApp: true, appType: 'tiktok' }
  }
  if (ua.includes('fban') || ua.includes('fbav') || ua.includes('fb_iab')) {
    return { isInApp: true, appType: 'facebook' }
  }
  if (ua.includes('whatsapp')) {
    return { isInApp: true, appType: 'whatsapp' }
  }

  // Comprobación de patrones comunes de WebViews genéricas
  const isGenericWebView = /(wv|webview)/i.test(ua) || (/(iphone|ipod|ipad).*applewebkit(?!.*safari)/i.test(ua))

  if (isGenericWebView) {
    return { isInApp: true, appType: 'other' }
  }

  return { isInApp: false, appType: null }
}

/**
 * Intenta forzar la apertura del navegador nativo del sistema (Chrome / Safari)
 * fuera de la WebView de Instagram o TikTok.
 */
export function attemptBrowserBreakout(targetUrl?: string): void {
  if (typeof window === 'undefined') return

  const url = targetUrl || window.location.href
  const isAndroid = /android/i.test(navigator.userAgent)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  if (isAndroid) {
    // Intent de Chrome para Android: fuerza la apertura fuera de la WebView
    const cleanUrl = url.replace(/^https?:\/\//, '')
    const chromeIntent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`
    window.location.href = chromeIntent
  } else if (isIOS) {
    // En iOS Safari no permite forzar directamente vía schema privado,
    // pero se copia el link al portapapeles y se informa al usuario.
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {})
    }
  }
}
