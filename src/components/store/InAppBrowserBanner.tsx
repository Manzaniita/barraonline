'use client'

import React, { useEffect, useState } from 'react'
import { detectInAppBrowser, attemptBrowserBreakout } from '@/lib/browser-detection'
import { ExternalLink, Copy, Check } from 'lucide-react'

export function InAppBrowserBanner() {
  const [isInApp, setIsInApp] = useState(false)
  const [appName, setAppName] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const info = detectInAppBrowser()
    if (info.isInApp) {
      setIsInApp(true)
      setAppName(
        info.appType === 'instagram'
          ? 'Instagram'
          : info.appType === 'tiktok'
          ? 'TikTok'
          : 'esta app'
      )
    }
  }, [])

  if (!isInApp) return null

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        <p className="flex-1 leading-snug">
          Estás navegando dentro de <strong>{appName}</strong>. Para una experiencia más rápida y segura, te sugerimos abrir en tu navegador habitual.
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => attemptBrowserBreakout()}
            className="flex items-center gap-1 bg-amber-500 text-black font-semibold px-2.5 py-1 rounded text-[11px] active:scale-95 transition-transform"
          >
            <ExternalLink className="w-3 h-3" />
            Abrir
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[11px] active:scale-95 transition-transform"
            title="Copiar enlace"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  )
}
