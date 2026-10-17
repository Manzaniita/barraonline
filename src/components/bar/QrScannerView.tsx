'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode'
import { barAudio } from './BarAudioFeedback'
import { BarVerifiedOrder } from '@/lib/bar-service'
import {
  Camera,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Terminal,
  UploadCloud,
  SwitchCamera,
  Sparkles,
} from 'lucide-react'

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
  const [scanSuccess, setScanSuccess] = useState(false)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const readerId = 'bar-qr-reader-viewport'

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null
    let isMounted = true

    async function initScanner() {
      try {
        // Inicializar Html5Qrcode con soporte exclusivo de QR y aceleración por hardware BarcodeDetector
        html5QrCode = new Html5Qrcode(readerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        })
        scannerRef.current = html5QrCode

        // Configuración de escaneo de alta sensibilidad
        const scanConfig = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            // 88% del área visible para permitir apuntar desde cualquier ángulo y distancia
            const size = Math.max(180, Math.floor(minEdge * 0.88))
            return { width: size, height: size }
          },
          aspectRatio: 1.0,
        }

        // Consultar cámaras disponibles
        let availableCameras: CameraDevice[] = []
        try {
          availableCameras = await Html5Qrcode.getCameras()
          if (isMounted) setCameras(availableCameras)
        } catch (camErr) {
          console.warn('No se pudieron listar cámaras explícitas:', camErr)
        }

        if (availableCameras.length > 0) {
          // Priorizar cámara trasera (back, rear, environment, trasera)
          const backCamIndex = availableCameras.findIndex((c) =>
            /back|rear|environment|trasera|0/i.test(c.label)
          )
          const targetIndex = backCamIndex !== -1 ? backCamIndex : availableCameras.length - 1
          if (isMounted) setCurrentCameraIndex(targetIndex)

          const targetCam = availableCameras[targetIndex]
          await html5QrCode.start(
            targetCam.id,
            scanConfig,
            (decodedText) => handleTokenScanned(decodedText),
            () => {}
          )
        } else {
          // Fallback a facingMode environment
          await html5QrCode.start(
            { facingMode: 'environment' },
            scanConfig,
            (decodedText) => handleTokenScanned(decodedText),
            () => {}
          )
        }

        if (isMounted) {
          setIsScanning(true)
          setCameraError(null)
        }
      } catch (err) {
        console.warn('Error iniciando cámara trasera, probando cámara general:', err)
        try {
          if (html5QrCode && isMounted) {
            await html5QrCode.start(
              { facingMode: 'user' },
              {
                fps: 20,
                qrbox: (w, h) => {
                  const size = Math.max(180, Math.floor(Math.min(w, h) * 0.88))
                  return { width: size, height: size }
                },
                aspectRatio: 1.0,
              },
              (decodedText) => handleTokenScanned(decodedText),
              () => {}
            )
            setIsScanning(true)
            setCameraError(null)
          }
        } catch (innerErr) {
          if (isMounted) {
            setCameraError(
              'No se pudo acceder a la cámara en vivo. Podés subir una foto del QR o ingresar el token debajo.'
            )
          }
        }
      }
    }

    initScanner()

    return () => {
      isMounted = false
      if (scannerRef.current) {
        const scanner = scannerRef.current
        scannerRef.current = null
        if (scanner.isScanning) {
          scanner.stop().catch(() => {})
        }
      }
    }
  }, [tenantSlug])

  const handleTokenScanned = async (token: string) => {
    if (isVerifying) return
    setIsVerifying(true)
    setScanSuccess(true)
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
        setScanSuccess(false)
        setScanMessage(`❌ ${data.error || 'Código QR no válido'}`)
        setTimeout(() => setScanMessage(null), 3500)
        return
      }

      barAudio.playSuccess()
      onOrderDetected(data.order, token.trim())
    } catch (err) {
      barAudio.playError()
      setScanSuccess(false)
      setScanMessage('Error de red al verificar QR en el servidor.')
    } finally {
      setTimeout(() => {
        setIsVerifying(false)
        setScanSuccess(false)
      }, 1000)
    }
  }

  // Cambiar entre múltiples lentes de cámara (ej: angular vs ultra-wide)
  const handleSwitchCamera = async () => {
    if (cameras.length < 2 || !scannerRef.current) return
    const nextIndex = (currentCameraIndex + 1) % cameras.length
    setCurrentCameraIndex(nextIndex)
    const nextCam = cameras[nextIndex]

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop()
      }
      await scannerRef.current.start(
        nextCam.id,
        {
          fps: 20,
          qrbox: (w, h) => {
            const size = Math.max(180, Math.floor(Math.min(w, h) * 0.88))
            return { width: size, height: size }
          },
          aspectRatio: 1.0,
        },
        (decodedText) => handleTokenScanned(decodedText),
        () => {}
      )
      setCameraError(null)
    } catch (err) {
      console.warn('Error alternando cámara:', err)
    }
  }

  // Escanear captura de pantalla o foto seleccionada de la galería
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !scannerRef.current) return

    setIsVerifying(true)
    setScanMessage('Procesando imagen del código QR...')

    try {
      const decodedText = await scannerRef.current.scanFile(file, false)
      await handleTokenScanned(decodedText)
    } catch (err) {
      barAudio.playError()
      setScanMessage('❌ No se detectó un código QR legible en la imagen.')
      setTimeout(() => setScanMessage(null), 3500)
      setIsVerifying(false)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualToken.trim()) return
    handleTokenScanned(manualToken.trim())
  }

  return (
    <div className="space-y-4">
      {/* Estilos inyectados para forzar el video de html5-qrcode a llenar el visor perfectamente */}
      <style jsx global>{`
        #bar-qr-reader-viewport {
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          border-radius: 1.5rem !important;
        }
        #bar-qr-reader-viewport video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1.5rem !important;
        }
        #qr-shaded-region {
          border-radius: 1rem !important;
          border-color: rgba(168, 85, 247, 0.4) !important;
        }
      `}</style>

      {/* Contenedor del Visor de Cámara */}
      <div
        className={`relative bg-black rounded-3xl overflow-hidden border-2 aspect-square max-w-sm mx-auto shadow-2xl flex items-center justify-center transition-all ${
          scanSuccess
            ? 'border-emerald-400 shadow-emerald-500/30'
            : isVerifying
            ? 'border-purple-400 animate-pulse'
            : 'border-purple-500/40'
        }`}
      >
        <div id={readerId} className="w-full h-full object-cover" />

        {/* Mira de Escaneo / Crosshair Responsivo */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
          <div className="w-full h-full max-w-[260px] max-h-[260px] border-2 border-dashed border-purple-400/70 rounded-2xl relative animate-pulse flex items-center justify-center">
            {/* Esquinas Neón */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />

            {/* Línea Láser Animada */}
            <div className="w-4/5 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_8px_#a855f7] animate-bounce" />
          </div>
        </div>

        {/* Alerta de Lectura en Vivo */}
        {scanMessage && (
          <div className="absolute bottom-4 inset-x-4 bg-black/95 border border-purple-500/50 rounded-2xl p-3 text-center text-xs font-bold text-white shadow-xl animate-in zoom-in duration-200">
            {scanMessage}
          </div>
        )}

        {isVerifying && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            <span>Validando firma del ticket...</span>
          </div>
        )}
      </div>

      {/* Controles de Cámara y Subida de Archivo */}
      <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
        {cameras.length > 1 && (
          <button
            onClick={handleSwitchCamera}
            className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-2.5 px-3 rounded-2xl text-xs active:scale-95 transition-all"
            title="Cambiar lente de cámara"
          >
            <SwitchCamera className="w-4 h-4 text-purple-400" />
            <span>Cambiar Cámara ({currentCameraIndex + 1}/{cameras.length})</span>
          </button>
        )}

        {/* Botón para escanear captura / foto de QR */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 font-semibold py-2.5 px-3 rounded-2xl text-xs active:scale-95 transition-all"
        >
          <UploadCloud className="w-4 h-4 text-purple-400" />
          <span>Subir Captura de QR</span>
        </button>
      </div>

      {cameraError && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/30 text-amber-200 rounded-2xl text-xs flex items-start gap-2 max-w-sm mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <span>{cameraError}</span>
        </div>
      )}

      <p className="text-center text-xs text-white/50">
        Apuntá al QR del cliente o subí una captura del ticket. Reconocimiento instantáneo.
      </p>

      {/* Entrada Manual de Respaldo para Pruebas en Computadora */}
      <div className="bg-[#12121a] border border-white/10 rounded-2xl p-3.5 max-w-sm mx-auto">
        <div className="flex items-center gap-1.5 text-xs text-white/60 mb-2 font-semibold">
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>Ingreso manual de token o ID (Pruebas / Fallback):</span>
        </div>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Pegar token criptográfico u orden..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500 font-mono"
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
