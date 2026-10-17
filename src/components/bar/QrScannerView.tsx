'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
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
  ZoomIn,
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

  // Zoom óptico/digital estilo Mercado Pago
  const [currentZoom, setCurrentZoom] = useState(1)
  const [maxZoom, setMaxZoom] = useState(1)
  const [supportsZoom, setSupportsZoom] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isVerifyingRef = useRef(false)
  const activeVideoTrackRef = useRef<MediaStreamTrack | null>(null)
  const stopNativeDetectorRef = useRef<(() => void) | null>(null)

  const readerId = 'bar-qr-reader-viewport'

  const handleTokenScanned = useCallback(
    async (token: string) => {
      const clean = token.trim()
      if (!clean || isVerifyingRef.current) return
      isVerifyingRef.current = true
      setIsVerifying(true)
      setScanSuccess(true)
      setScanMessage(null)

      try {
        const res = await fetch('/api/bar/verify-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrToken: clean, tenantSlug }),
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
        onOrderDetected(data.order, clean)
      } catch (err) {
        barAudio.playError()
        setScanSuccess(false)
        setScanMessage('Error de red al verificar QR en el servidor.')
      } finally {
        setTimeout(() => {
          isVerifyingRef.current = false
          setIsVerifying(false)
          setScanSuccess(false)
        }, 1200)
      }
    },
    [tenantSlug, onOrderDetected]
  )

  // Iniciar bucle acelerado por hardware nativo (BarcodeDetector) sobre el elemento <video>
  const startHardwareDetector = useCallback(
    (videoEl: HTMLVideoElement) => {
      if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return

      let isRunning = true
      stopNativeDetectorRef.current = () => {
        isRunning = false
      }

      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        })

        const loop = async () => {
          if (!isRunning) return

          if (videoEl.readyState >= 2 && !videoEl.paused && !isVerifyingRef.current) {
            try {
              const barcodes = await barcodeDetector.detect(videoEl)
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleTokenScanned(barcodes[0].rawValue)
              }
            } catch {}
          }

          if (isRunning) {
            if ('requestVideoFrameCallback' in videoEl) {
              ;(videoEl as any).requestVideoFrameCallback(loop)
            } else {
              requestAnimationFrame(loop)
            }
          }
        }

        if ('requestVideoFrameCallback' in videoEl) {
          ;(videoEl as any).requestVideoFrameCallback(loop)
        } else {
          requestAnimationFrame(loop)
        }
      } catch (err) {
        console.warn('Hardware BarcodeDetector error:', err)
      }
    },
    [handleTokenScanned]
  )

  // Configurar zoom en el stream
  const applyZoom = useCallback(async (zoomValue: number) => {
    const track = activeVideoTrackRef.current
    if (!track) return
    try {
      await (track as any).applyConstraints({
        advanced: [{ zoom: zoomValue }],
      })
      setCurrentZoom(zoomValue)
    } catch (err) {
      console.warn('Error aplicando zoom de cámara:', err)
    }
  }, [])

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null
    let isMounted = true

    async function initScanner() {
      try {
        html5QrCode = new Html5Qrcode(readerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        })
        scannerRef.current = html5QrCode

        // CONFIGURACIÓN ESTILO MERCADO PAGO:
        // 1. Alta tasa de cuadros por segundo (30 FPS)
        // 2. SIN qrbox recortado (evalúa el 100% del frame completo de la cámara)
        const scanConfig = {
          fps: 30,
          aspectRatio: 1.0,
          disableFlip: true,
        }

        // Constraints de Alta Definición (1080p con autofoco continuo)
        const hdConstraints: MediaTrackConstraints = {
          facingMode: 'environment',
          width: { min: 1280, ideal: 1920 },
          height: { min: 720, ideal: 1080 },
          advanced: [
            { focusMode: 'continuous' } as any,
            { exposureMode: 'continuous' } as any,
          ],
        }

        // Detectar cámaras físicas
        let availableCameras: CameraDevice[] = []
        try {
          availableCameras = await Html5Qrcode.getCameras()
          if (isMounted) setCameras(availableCameras)
        } catch (camErr) {
          console.warn('No se pudieron listar cámaras:', camErr)
        }

        if (availableCameras.length > 0) {
          // Priorizar cámara trasera principal (evita teleobjetivos o ultra-wide fijos)
          const backCamIndex = availableCameras.findIndex((c) =>
            /back|rear|environment|trasera|0/i.test(c.label)
          )
          const targetIndex = backCamIndex !== -1 ? backCamIndex : availableCameras.length - 1
          if (isMounted) setCurrentCameraIndex(targetIndex)

          const targetCam = availableCameras[targetIndex]
          await html5QrCode.start(
            {
              deviceId: { exact: targetCam.id },
              ...hdConstraints,
            },
            scanConfig,
            (decodedText) => handleTokenScanned(decodedText),
            () => {}
          )
        } else {
          await html5QrCode.start(
            hdConstraints,
            scanConfig,
            (decodedText) => handleTokenScanned(decodedText),
            () => {}
          )
        }

        if (isMounted) {
          setIsScanning(true)
          setCameraError(null)

          // Extraer capacidades del track de video (Zoom y Autofoco)
          setTimeout(() => {
            const videoEl = document.querySelector(`#${readerId} video`) as HTMLVideoElement | null
            if (videoEl && videoEl.srcObject) {
              const stream = videoEl.srcObject as MediaStream
              const track = stream.getVideoTracks()[0]
              if (track) {
                activeVideoTrackRef.current = track
                const caps = track.getCapabilities ? (track.getCapabilities() as any) : null
                if (caps && caps.zoom) {
                  setSupportsZoom(true)
                  const maxZ = Math.min(caps.zoom.max || 3, 3)
                  setMaxZoom(maxZ)
                  // Aplicar zoom ligero (1.2x) por defecto para emular el encuadre natural de Mercado Pago
                  if (caps.zoom.min <= 1.2 && caps.zoom.max >= 1.2) {
                    applyZoom(1.2)
                  }
                }
              }

              // Iniciar detector nativo por hardware a 60fps sobre el video
              startHardwareDetector(videoEl)
            }
          }, 300)
        }
      } catch (err) {
        console.warn('Fallback a cámara general por error HD:', err)
        try {
          if (html5QrCode && isMounted) {
            await html5QrCode.start(
              { facingMode: 'environment' },
              { fps: 25, aspectRatio: 1.0 },
              (decodedText) => handleTokenScanned(decodedText),
              () => {}
            )
            setIsScanning(true)
            setCameraError(null)
          }
        } catch (innerErr) {
          if (isMounted) {
            setCameraError(
              'No se pudo iniciar la cámara en vivo. Podés subir una foto del QR o ingresar el token debajo.'
            )
          }
        }
      }
    }

    initScanner()

    return () => {
      isMounted = false
      if (stopNativeDetectorRef.current) {
        stopNativeDetectorRef.current()
        stopNativeDetectorRef.current = null
      }
      activeVideoTrackRef.current = null

      if (scannerRef.current) {
        const scanner = scannerRef.current
        scannerRef.current = null
        if (scanner.isScanning) {
          scanner.stop().catch(() => {})
        }
      }
    }
  }, [tenantSlug, handleTokenScanned, startHardwareDetector, applyZoom])

  // Alternar entre cámaras
  const handleSwitchCamera = async () => {
    if (cameras.length < 2 || !scannerRef.current) return
    const nextIndex = (currentCameraIndex + 1) % cameras.length
    setCurrentCameraIndex(nextIndex)
    const nextCam = cameras[nextIndex]

    if (stopNativeDetectorRef.current) {
      stopNativeDetectorRef.current()
      stopNativeDetectorRef.current = null
    }

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop()
      }
      await scannerRef.current.start(
        {
          deviceId: { exact: nextCam.id },
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        { fps: 30, aspectRatio: 1.0 },
        (decodedText) => handleTokenScanned(decodedText),
        () => {}
      )
      setCameraError(null)

      setTimeout(() => {
        const videoEl = document.querySelector(`#${readerId} video`) as HTMLVideoElement | null
        if (videoEl) {
          startHardwareDetector(videoEl)
        }
      }, 300)
    } catch (err) {
      console.warn('Error alternando cámara:', err)
    }
  }

  // Escanear captura de pantalla o foto seleccionada
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
      {/* Estilos inyectados: video 100% fluido en Full HD sin recorte */}
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
          display: none !important;
        }
      `}</style>

      {/* Contenedor del Visor de Cámara */}
      <div
        className={`relative bg-black rounded-3xl overflow-hidden border-2 aspect-square max-w-sm mx-auto shadow-2xl flex items-center justify-center transition-all ${
          scanSuccess
            ? 'border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-500/20'
            : isVerifying
            ? 'border-purple-400 animate-pulse'
            : 'border-purple-500/40 shadow-purple-600/10'
        }`}
      >
        <div id={readerId} className="w-full h-full object-cover" />

        {/* Mira Láser Dinámica de Alto Alcance */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
          <div className="w-full h-full border-2 border-white/20 rounded-2xl relative flex items-center justify-center">
            {/* Esquinas Estilo Escáner Profesional */}
            <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-purple-400 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-purple-400 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-purple-400 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-purple-400 rounded-br-xl" />

            {/* Haz Láser Neón Continuo */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-pink-500 to-transparent shadow-[0_0_12px_#ec4899] animate-pulse" />
          </div>
        </div>

        {/* Control de Zoom estilo Mercado Pago */}
        {supportsZoom && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/20 z-10">
            <button
              onClick={() => applyZoom(1)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                currentZoom <= 1.1
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              1x
            </button>
            <button
              onClick={() => applyZoom(Math.min(2, maxZoom))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                currentZoom > 1.1
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              2x
            </button>
          </div>
        )}

        {/* Alerta de Lectura en Vivo */}
        {scanMessage && (
          <div className="absolute bottom-4 inset-x-4 bg-black/95 border border-purple-500/50 rounded-2xl p-3 text-center text-xs font-bold text-white shadow-xl animate-in zoom-in duration-200 z-20">
            {scanMessage}
          </div>
        )}

        {isVerifying && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2 z-20">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            <span>Validando ticket en tiempo real...</span>
          </div>
        )}
      </div>

      {/* Controles de Lente y Archivos */}
      <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
        {cameras.length > 1 && (
          <button
            onClick={handleSwitchCamera}
            className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-2.5 px-3 rounded-2xl text-xs active:scale-95 transition-all"
            title="Cambiar lente de cámara"
          >
            <SwitchCamera className="w-4 h-4 text-purple-400" />
            <span>Lente ({currentCameraIndex + 1}/{cameras.length})</span>
          </button>
        )}

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
          <span>Subir Captura QR</span>
        </button>
      </div>

      {cameraError && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/30 text-amber-200 rounded-2xl text-xs flex items-start gap-2 max-w-sm mx-auto">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <span>{cameraError}</span>
        </div>
      )}

      <p className="text-center text-xs text-white/50">
        Reconocimiento instantáneo de alta velocidad en Full HD. Funciona desde 1 a 2 metros.
      </p>

      {/* Entrada Manual de Respaldo */}
      <div className="bg-[#12121a] border border-white/10 rounded-2xl p-3.5 max-w-sm mx-auto">
        <div className="flex items-center gap-1.5 text-xs text-white/60 mb-2 font-semibold">
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>Ingreso manual de token o ID (Fallback):</span>
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
