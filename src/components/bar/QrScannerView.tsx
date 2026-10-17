'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import jsQR from 'jsqr'
import { barAudio } from './BarAudioFeedback'
import { BarVerifiedOrder } from '@/lib/bar-service'
import {
  Camera,
  RefreshCw,
  AlertCircle,
  Terminal,
  UploadCloud,
  SwitchCamera,
  RotateCcw,
  Flashlight,
  Zap,
} from 'lucide-react'

interface QrScannerViewProps {
  tenantSlug: string
  onOrderDetected: (order: BarVerifiedOrder, qrToken: string) => void
  paused?: boolean
}

interface VideoDeviceOption {
  deviceId: string
  label: string
}

export function QrScannerView({
  tenantSlug,
  onOrderDetected,
  paused = false,
}: QrScannerViewProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanSuccess, setScanSuccess] = useState(false)

  // Cámaras y controles de hardware (Zoom + Linterna estilo Posnet Mercado Pago)
  const [cameras, setCameras] = useState<VideoDeviceOption[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const [currentZoom, setCurrentZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1)
  const [maxZoom, setMaxZoom] = useState(1)
  const [supportsZoom, setSupportsZoom] = useState(false)
  const [supportsTorch, setSupportsTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [engineBadge, setEngineBadge] = useState<'NPU+TURBO' | 'TURBO-60FPS'>('TURBO-60FPS')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const activeTrackRef = useRef<MediaStreamTrack | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null)

  const isVerifyingRef = useRef(false)
  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const lastScannedTokenRef = useRef<{ token: string; timestamp: number }>({
    token: '',
    timestamp: 0,
  })
  const sessionCounterRef = useRef(0)
  const stopLoopRef = useRef<(() => void) | null>(null)

  // Procesar el token apenas es detectado por cualquiera de los motores
  const handleTokenScanned = useCallback(
    async (rawToken: string) => {
      const clean = rawToken.trim()
      if (!clean || isVerifyingRef.current || pausedRef.current) return

      // Evitar lecturas duplicadas del mismo QR en menos de 1.8 segundos
      const now = Date.now()
      if (
        lastScannedTokenRef.current.token === clean &&
        now - lastScannedTokenRef.current.timestamp < 1800
      ) {
        return
      }
      lastScannedTokenRef.current = { token: clean, timestamp: now }

      isVerifyingRef.current = true
      setIsVerifying(true)
      setScanSuccess(true)
      setScanMessage(null)

      // Feedback háptico instantáneo en celulares Android
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(45)
        }
      } catch {}

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
          setTimeout(() => setScanMessage(null), 3200)
          return
        }

        barAudio.playSuccess()
        onOrderDetected(data.order, clean)
      } catch {
        barAudio.playError()
        setScanSuccess(false)
        setScanMessage('❌ Error de red al verificar el QR con el servidor.')
        setTimeout(() => setScanMessage(null), 3200)
      } finally {
        setTimeout(() => {
          isVerifyingRef.current = false
          setIsVerifying(false)
          setScanSuccess(false)
        }, 900)
      }
    },
    [tenantSlug, onOrderDetected]
  )

  // Detener de forma limpia cualquier stream y bucle de escaneo previo
  const stopCurrentStream = useCallback(() => {
    if (stopLoopRef.current) {
      stopLoopRef.current()
      stopLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.onended = null
          track.stop()
        } catch {}
      })
      streamRef.current = null
    }
    activeTrackRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Motor Dual de Detección Posnet a 60fps:
  // 1) Hardware NPU (BarcodeDetector nativo si existe)
  // 2) Doble pasada jsQR en Canvas de alta velocidad:
  //    - Pasada A (Full-Frame Wide 480p): detecta el QR apenas asoma en cualquier borde de la cámara
  //    - Pasada B (Center Macro 2x ROI): recorta el centro en resolución nativa 1:1 para leer QRs lejanos o pequeños
  const startPosnetDetectionLoop = useCallback(
    (videoEl: HTMLVideoElement) => {
      if (stopLoopRef.current) {
        stopLoopRef.current()
      }

      let active = true
      stopLoopRef.current = () => {
        active = false
      }

      // Inicializar Canvas en memoria optimizado para CPU caché
      const wideCanvas = document.createElement('canvas')
      const wideCtx = wideCanvas.getContext('2d', { willReadFrequently: true })

      const macroCanvas = document.createElement('canvas')
      const macroCtx = macroCanvas.getContext('2d', { willReadFrequently: true })

      // Inicializar detector por hardware si el navegador lo soporta
      let nativeDetector: any = null
      let isHardwareDetecting = false

      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          nativeDetector = new (window as any).BarcodeDetector({
            formats: ['qr_code'],
          })
          setEngineBadge('NPU+TURBO')
        } catch {
          nativeDetector = null
        }
      }

      let frameCount = 0

      const tick = () => {
        if (!active) return

        const vw = videoEl.videoWidth
        const vh = videoEl.videoHeight

        if (
          videoEl.readyState >= 2 &&
          vw > 0 &&
          vh > 0 &&
          !videoEl.paused &&
          !isVerifyingRef.current &&
          !pausedRef.current
        ) {
          frameCount++

          // MOTOR 1: Hardware NPU en paralelo sin bloquear el hilo principal
          if (nativeDetector && !isHardwareDetecting) {
            isHardwareDetecting = true
            nativeDetector
              .detect(videoEl)
              .then((barcodes: any[]) => {
                if (active && barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
                  handleTokenScanned(barcodes[0].rawValue)
                }
              })
              .catch(() => {})
              .finally(() => {
                isHardwareDetecting = false
              })
          }

          // MOTOR 2A: Pasada Wide Full-Frame (lee todo el ángulo de cámara en ~3ms)
          if (wideCtx) {
            const targetW = 440
            const scale = targetW / Math.max(vw, vh)
            const w = Math.max(120, Math.floor(vw * scale))
            const h = Math.max(120, Math.floor(vh * scale))

            if (wideCanvas.width !== w) wideCanvas.width = w
            if (wideCanvas.height !== h) wideCanvas.height = h

            wideCtx.drawImage(videoEl, 0, 0, w, h)
            const imgData = wideCtx.getImageData(0, 0, w, h)
            const code = jsQR(imgData.data, w, h, {
              inversionAttempts: 'dontInvert',
            })

            if (code && code.data && code.data.trim().length > 0) {
              handleTokenScanned(code.data)
            } else if (macroCtx && frameCount % 2 === 0) {
              // MOTOR 2B: Pasada Teleobjetivo 2x (Recorte central 1:1 en frames pares para QRs alejados o con brillo nocturno)
              const cropSize = Math.floor(Math.min(vw, vh) * 0.55)
              const sx = Math.floor((vw - cropSize) / 2)
              const sy = Math.floor((vh - cropSize) / 2)
              const roiDim = 360

              if (macroCanvas.width !== roiDim) macroCanvas.width = roiDim
              if (macroCanvas.height !== roiDim) macroCanvas.height = roiDim

              macroCtx.drawImage(videoEl, sx, sy, cropSize, cropSize, 0, 0, roiDim, roiDim)
              const macroData = macroCtx.getImageData(0, 0, roiDim, roiDim)
              const macroCode = jsQR(macroData.data, roiDim, roiDim, {
                inversionAttempts: 'attemptBoth',
              })

              if (macroCode && macroCode.data && macroCode.data.trim().length > 0) {
                handleTokenScanned(macroCode.data)
              }
            }
          }
        }

        if (active) {
          if ('requestVideoFrameCallback' in videoEl) {
            ;(videoEl as any).requestVideoFrameCallback(tick)
          } else {
            requestAnimationFrame(tick)
          }
        }
      }

      if ('requestVideoFrameCallback' in videoEl) {
        ;(videoEl as any).requestVideoFrameCallback(tick)
      } else {
        requestAnimationFrame(tick)
      }
    },
    [handleTokenScanned]
  )

  // Configurar hardware de la lente (autofoco continuo, exposición continua, zoom, linterna)
  const configureCameraTrackHardware = useCallback((track: MediaStreamTrack) => {
    activeTrackRef.current = track
    setSupportsZoom(false)
    setSupportsTorch(false)
    setTorchOn(false)
    setCurrentZoom(1)

    try {
      const caps = track.getCapabilities ? (track.getCapabilities() as any) : null
      if (!caps) return

      const advancedConstraints: Record<string, any> = {}

      // Forzar autofoco continuo rápido para lectura instantánea a cualquier distancia
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        advancedConstraints.focusMode = 'continuous'
      }
      // Evitar encandilamiento de pantallas brillantes en oscuridad del boliche
      if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
        advancedConstraints.exposureMode = 'continuous'
      }
      if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
        advancedConstraints.whiteBalanceMode = 'continuous'
      }

      if (Object.keys(advancedConstraints).length > 0) {
        track.applyConstraints({ advanced: [advancedConstraints] } as any).catch(() => {})
      }

      // Detectar capacidad de Zoom Óptico/Digital
      if (caps.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > 1) {
        setSupportsZoom(true)
        setMinZoom(caps.zoom.min || 1)
        setMaxZoom(Math.min(caps.zoom.max, 4))
        setCurrentZoom(caps.zoom.min || 1)
      }

      // Detectar capacidad de Linterna / Flash
      if (caps.torch) {
        setSupportsTorch(true)
      }
    } catch {}
  }, [])

  // Apertura progresiva en 4 etapas a prueba de fallos en iOS Safari y Android Chrome
  const startCameraStream = useCallback(
    async (preferredDeviceId?: string) => {
      const currentSession = ++sessionCounterRef.current
      setCameraError(null)
      setIsStartingCamera(true)
      setIsScanning(false)

      stopCurrentStream()

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setIsStartingCamera(false)
        setCameraError(
          'El navegador bloqueó el acceso directo a la cámara (requiere HTTPS o localhost). Usá el botón "Abrir Cámara Nativa / Foto" debajo.'
        )
        return
      }

      // Lista de intentos progresivos para no fallar jamás por OverconstrainedError
      const constraintCandidates: MediaStreamConstraints[] = []

      if (preferredDeviceId) {
        constraintCandidates.push({
          audio: false,
          video: {
            deviceId: { exact: preferredDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        })
        constraintCandidates.push({
          audio: false,
          video: { deviceId: { exact: preferredDeviceId } },
        })
      }

      // Etapa 1: Cámara trasera en HD 720p a 30+ fps (ideal para Posnet)
      constraintCandidates.push({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      })

      // Etapa 2: Cámara trasera estándar sin restricciones de resolución
      constraintCandidates.push({
        audio: false,
        video: { facingMode: 'environment' },
      })

      // Etapa 3: Cualquier cámara disponible en el dispositivo
      constraintCandidates.push({
        audio: false,
        video: true,
      })

      let obtainedStream: MediaStream | null = null
      let lastErr: any = null

      for (const constraints of constraintCandidates) {
        try {
          obtainedStream = await navigator.mediaDevices.getUserMedia(constraints)
          if (obtainedStream) break
        } catch (err: any) {
          lastErr = err
          // Si el usuario denegó explícitamente el permiso, no seguir ciclando
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
            break
          }
        }
      }

      // Si el componente se desmontó o cambió mientras abríamos la cámara, cerrar inmediatamente
      if (currentSession !== sessionCounterRef.current) {
        if (obtainedStream) {
          obtainedStream.getTracks().forEach((t) => t.stop())
        }
        return
      }

      if (!obtainedStream) {
        setIsStartingCamera(false)
        const isPermissionDenied =
          lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError'
        setCameraError(
          isPermissionDenied
            ? 'Permiso de cámara denegado. Habilitalo en el ícono del candado de la barra de direcciones o usá "Cámara Rápida / Subir QR".'
            : 'No se pudo iniciar la cámara automáticamente. Tocá "Reintentar" o usá "Cámara Rápida / Subir QR".'
        )
        return
      }

      streamRef.current = obtainedStream
      const videoTrack = obtainedStream.getVideoTracks()[0]

      if (videoTrack) {
        configureCameraTrackHardware(videoTrack)

        // Si el sistema operativo corta el track (ej. al minimizar el navegador), reconectar automáticamente
        videoTrack.onended = () => {
          if (
            currentSession === sessionCounterRef.current &&
            document.visibilityState === 'visible'
          ) {
            startCameraStream(preferredDeviceId)
          }
        }
      }

      // Enumerar cámaras disponibles para permitir cambio de lente
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (currentSession !== sessionCounterRef.current) return
          const videoInputs = devices
            .filter((d) => d.kind === 'videoinput')
            .map((d, idx) => ({
              deviceId: d.deviceId,
              label: d.label || `Lente ${idx + 1}`,
            }))
          if (videoInputs.length > 0) {
            setCameras(videoInputs)
            if (videoTrack) {
              const currentSettings = videoTrack.getSettings()
              const activeIdx = videoInputs.findIndex(
                (c) => c.deviceId === currentSettings.deviceId
              )
              if (activeIdx >= 0) setCurrentCameraIndex(activeIdx)
            }
          }
        })
        .catch(() => {})

      const videoEl = videoRef.current
      if (!videoEl) {
        setIsStartingCamera(false)
        return
      }

      // Atributos nativos obligatorios para reproducción en vivo en iOS Safari y WebViews
      videoEl.setAttribute('playsinline', 'true')
      videoEl.setAttribute('webkit-playsinline', 'true')
      videoEl.muted = true
      videoEl.autoplay = true
      videoEl.srcObject = obtainedStream

      try {
        await videoEl.play()
      } catch {
        // Fallback si play() requiere esperar onloadedmetadata
        await new Promise<void>((resolve) => {
          videoEl.onloadedmetadata = () => {
            videoEl.play().catch(() => {})
            resolve()
          }
        })
      }

      if (currentSession !== sessionCounterRef.current) return

      setIsStartingCamera(false)
      setIsScanning(true)
      setCameraError(null)

      startPosnetDetectionLoop(videoEl)
    },
    [stopCurrentStream, configureCameraTrackHardware, startPosnetDetectionLoop]
  )

  // Iniciar cámara al montar y auto-recuperar cuando el celular vuelve de bloqueo/segundo plano
  useEffect(() => {
    startCameraStream()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const track = activeTrackRef.current
        if (!track || track.readyState === 'ended' || !videoRef.current?.srcObject) {
          startCameraStream()
        } else if (videoRef.current?.paused) {
          videoRef.current.play().catch(() => {})
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      sessionCounterRef.current++
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopCurrentStream()
    }
  }, [startCameraStream, stopCurrentStream])

  // Aplicar zoom óptico/digital en vivo
  const applyZoom = useCallback(async (zoomValue: number) => {
    const track = activeTrackRef.current
    if (!track) return
    try {
      await track.applyConstraints({
        advanced: [{ zoom: zoomValue } as any],
      })
      setCurrentZoom(zoomValue)
    } catch {}
  }, [])

  // Activar/desactivar linterna para lectura en barra a oscuras
  const toggleTorch = useCallback(async () => {
    const track = activeTrackRef.current
    if (!track) return
    const nextState = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextState } as any],
      })
      setTorchOn(nextState)
    } catch {}
  }, [torchOn])

  // Cambiar entre lentes de cámara
  const handleSwitchCamera = async () => {
    if (cameras.length < 2) return
    const nextIndex = (currentCameraIndex + 1) % cameras.length
    setCurrentCameraIndex(nextIndex)
    await startCameraStream(cameras[nextIndex].deviceId)
  }

  // Decodificador multiescala instantáneo para capturas de pantalla o fotos de cámara nativa
  const decodeImageFileMultiScale = async (file: File): Promise<string | null> => {
    // 1. Probar con BarcodeDetector nativo si está disponible
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window && 'createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file)
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const results = await detector.detect(bitmap)
        bitmap.close?.()
        if (results && results.length > 0 && results[0]?.rawValue) {
          return results[0].rawValue
        }
      } catch {}
    }

    // 2. Decodificación multiescala con jsQR (1200px, 800px, 500px) para capturas de pantalla completas
    const objectUrl = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = objectUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null

      const targetSizes = [1000, 700, 450]
      for (const maxDim of targetSizes) {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(100, Math.floor(img.width * scale))
        const h = Math.max(100, Math.floor(img.height * scale))
        canvas.width = w
        canvas.height = h
        ctx.drawImage(img, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        const decoded = jsQR(imageData.data, w, h, {
          inversionAttempts: 'attemptBoth',
        })
        if (decoded && decoded.data) {
          return decoded.data
        }
      }

      return null
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsVerifying(true)
    setScanMessage('Escaneando imagen del código QR...')

    try {
      const decodedText = await decodeImageFileMultiScale(file)
      if (decodedText) {
        setIsVerifying(false)
        await handleTokenScanned(decodedText)
      } else {
        barAudio.playError()
        setScanMessage('❌ No se detectó un código QR válido en la imagen.')
        setTimeout(() => setScanMessage(null), 3500)
        setIsVerifying(false)
      }
    } catch {
      barAudio.playError()
      setScanMessage('❌ No se pudo leer el archivo seleccionado.')
      setTimeout(() => setScanMessage(null), 3500)
      setIsVerifying(false)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = ''
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualToken.trim()) return
    handleTokenScanned(manualToken.trim())
  }

  return (
    <div className="space-y-4">
      {/* Visor de Cámara Posnet de Alta Velocidad */}
      <div
        className={`relative bg-black rounded-3xl overflow-hidden border-2 aspect-square max-w-sm mx-auto shadow-2xl flex items-center justify-center transition-all duration-150 ${
          scanSuccess
            ? 'border-emerald-400 shadow-emerald-500/40 ring-4 ring-emerald-500/30 scale-[1.01]'
            : isVerifying
            ? 'border-purple-400 animate-pulse'
            : 'border-purple-500/40 shadow-purple-600/10'
        }`}
      >
        {/* Elemento <video> nativo controlado directamente por React */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Badge superior de motor activo */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/65 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 z-10 pointer-events-none">
          <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
          <span className="text-[10px] font-extrabold tracking-wider text-white/90 font-mono">
            POSNET {engineBadge}
          </span>
        </div>

        {/* Botón de Linterna / Flash si el celular lo soporta */}
        {supportsTorch && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`absolute top-3 right-3 p-2 rounded-full border backdrop-blur-md z-10 transition-all active:scale-90 ${
              torchOn
                ? 'bg-amber-400 text-black border-amber-300 shadow-lg shadow-amber-400/40'
                : 'bg-black/65 text-white/80 border-white/20 hover:text-white'
            }`}
            title="Linterna / Flash"
          >
            <Flashlight className="w-4 h-4" />
          </button>
        )}

        {/* Mira Láser de Cobertura Completa */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-5">
          <div
            className={`w-full h-full border-2 rounded-2xl relative flex items-center justify-center transition-colors ${
              scanSuccess ? 'border-emerald-400/80 bg-emerald-500/10' : 'border-white/20'
            }`}
          >
            {/* Esquinas Neón */}
            <div
              className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl transition-colors ${
                scanSuccess ? 'border-emerald-400' : 'border-purple-400'
              }`}
            />
            <div
              className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl transition-colors ${
                scanSuccess ? 'border-emerald-400' : 'border-purple-400'
              }`}
            />
            <div
              className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl transition-colors ${
                scanSuccess ? 'border-emerald-400' : 'border-purple-400'
              }`}
            />
            <div
              className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-xl transition-colors ${
                scanSuccess ? 'border-emerald-400' : 'border-purple-400'
              }`}
            />

            {/* Haz Láser Neón */}
            {isScanning && !isVerifying && (
              <div className="w-5/6 h-0.5 bg-gradient-to-r from-transparent via-pink-500 to-transparent shadow-[0_0_14px_#ec4899] animate-pulse" />
            )}
          </div>
        </div>

        {/* Estado de Carga Inicial de la Cámara */}
        {isStartingCamera && !cameraError && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-xs font-semibold gap-2.5 z-15">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            <span>Iniciando lente de alta velocidad...</span>
          </div>
        )}

        {/* Control de Zoom Óptico/Digital estilo Mercado Pago */}
        {supportsZoom && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/70 backdrop-blur-md p-1 rounded-full border border-white/20 z-10">
            <button
              type="button"
              onClick={() => applyZoom(minZoom)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                currentZoom <= minZoom + 0.2
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              1x
            </button>
            {maxZoom >= 1.5 && (
              <button
                type="button"
                onClick={() => applyZoom(Math.min(1.5, maxZoom))}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                  currentZoom > minZoom + 0.2 && currentZoom < 1.8
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                1.5x
              </button>
            )}
            <button
              type="button"
              onClick={() => applyZoom(Math.min(2, maxZoom))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                currentZoom >= 1.8
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
          <div className="absolute bottom-4 inset-x-4 bg-black/95 border border-purple-500/50 rounded-2xl p-3 text-center text-xs font-bold text-white shadow-xl animate-in zoom-in duration-150 z-20">
            {scanMessage}
          </div>
        )}

        {isVerifying && (
          <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2 z-20">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Validando ticket al instante...</span>
          </div>
        )}
      </div>

      {/* Controles de Lente, Cámara Nativa y Subida de Captura */}
      <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
        {cameras.length > 1 && (
          <button
            type="button"
            onClick={handleSwitchCamera}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-2.5 px-3 rounded-2xl text-xs active:scale-95 transition-all"
            title="Cambiar lente de cámara"
          >
            <SwitchCamera className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="truncate">
              Lente ({currentCameraIndex + 1}/{cameras.length})
            </span>
          </button>
        )}

        {/* Input oculto para abrir la app de Cámara Nativa del celular (funciona incluso sin HTTPS) */}
        <input
          type="file"
          ref={nativeCameraInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Input oculto para subir captura desde galería */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 font-semibold py-2.5 px-3 rounded-2xl text-xs active:scale-95 transition-all"
        >
          <UploadCloud className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Subir Captura QR</span>
        </button>
      </div>

      {/* Si hubo error de permisos o HTTP sin SSL, mostrar botones de recuperación inmediata */}
      {cameraError && (
        <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 text-amber-200 rounded-2xl text-xs space-y-2.5 max-w-sm mx-auto">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span className="leading-relaxed">{cameraError}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => startCameraStream()}
              className="bg-amber-500/30 hover:bg-amber-500/40 border border-amber-500/50 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Cámara Nativa</span>
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-white/50">
        Detección panorámica instantánea (60 FPS + Macro 2x automático). No hace falta encuadrar perfecto.
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
