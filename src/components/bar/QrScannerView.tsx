'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { barAudio } from './BarAudioFeedback'
import { BarVerifiedOrder } from '@/lib/bar-service'
import { Camera, RefreshCw, AlertCircle, CheckCircle, Flashlight, Terminal } from 'lucide-react'

interface QrScannerViewProps {
  tenantSlug: string
  onOrderDetected: (order: BarVerifiedOrder, qrToken: string) => void
}

export function QrScannerView({ tenantSlug, onOrderDetected }: QrScannerViewProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const readerId = 'bar-qr-reader-viewport'

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null

    async function startScanner() {
      try {
        html5QrCode = new Html5Qrcode(readerId)
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: 'environment' }, // Cámara trasera del celular
          {
            fps: 15,
            qrbox: { width: 260, height: 260 },
          },
          async (decodedText) => {
            // Callback al detectar QR
            handleTokenScanned(decodedText)
          },
          () => {
            // Escaneo continuo frame a frame sin error
          }
        )
        setIsScanning(true)
      } catch (err) {
        console.warn('No se pudo iniciar cámara trasera, probando cualquier cámara:', err)
        try {
          if (html5QrCode) {
            await html5QrCode.start(
              { facingMode: 'user' },
              { fps: 15, qrbox: { width: 260, height: 260 } },
              (decodedText) => handleTokenScanned(decodedText),
              () => {}
            )
            setIsScanning(true)
          }
        } catch (innerErr) {
          setCameraError(
            'No se pudo acceder a la cámara. Podés ingresar o pegar el código QR manualmente debajo.'
          )
        }
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null
          })
      }
    }
  }, [tenantSlug])

  const handleTokenScanned = async (token: string) => {
    if (isVerifying) return
    setIsVerifying(true)
    setScanMessage(null)

    try {
      const res = await fetch('/api/bar/verify-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: token.trim(), tenantSlug }),
      })

      const data = await res.json()

      if (!res.ok || !data.valid) {
        barAudio.playError()
        setScanMessage(`❌ ${data.error || 'Código QR no válido'}`)
        setTimeout(() => setScanMessage(null), 3500)
        return
      }

      barAudio.playSuccess()
      onOrderDetected(data.order, token.trim())
    } catch (err) {
      barAudio.playError()
      setScanMessage('Error al verificar QR en el servidor.')
    } finally {
      setTimeout(() => {
        setIsVerifying(false)
      }, 1000)
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualToken.trim()) return
    handleTokenScanned(manualToken.trim())
  }

  return (
    <div className="space-y-4">
      {/* Contenedor del Visor de Cámara */}
      <div className="relative bg-black rounded-3xl overflow-hidden border-2 border-purple-500/30 aspect-square max-w-sm mx-auto shadow-2xl flex items-center justify-center">
        <div id={readerId} className="w-full h-full object-cover" />

        {/* Mira de Escaneo / Crosshair */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
          <div className="w-64 h-64 border-2 border-dashed border-purple-400/80 rounded-2xl relative animate-pulse">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />
          </div>
        </div>

        {/* Alerta de Lectura en Vivo */}
        {scanMessage && (
          <div className="absolute bottom-4 inset-x-4 bg-black/90 border border-red-500/50 rounded-2xl p-3 text-center text-xs font-bold text-red-300 shadow-xl animate-in zoom-in duration-200">
            {scanMessage}
          </div>
        )}

        {isVerifying && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            <span>Verificando firma criptográfica...</span>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-white/50">
        Apuntá la cámara al código QR en el celular del cliente. Lectura instantánea en &lt;300ms.
      </p>

      {/* Entrada Manual de Respaldo para Pruebas en Computadora */}
      <div className="bg-[#12121a] border border-white/10 rounded-2xl p-3.5 max-w-sm mx-auto">
        <div className="flex items-center gap-1.5 text-xs text-white/60 mb-2 font-semibold">
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>Ingreso manual de token QR (Pruebas / Fallback):</span>
        </div>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Pegar token criptográfico..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={isVerifying || !manualToken.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-3.5 py-2 rounded-xl text-xs active:scale-95 transition-all"
          >
            Verificar
          </button>
        </form>
      </div>
    </div>
  )
}
