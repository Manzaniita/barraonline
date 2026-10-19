// src/config/constants.ts

export const APP_CONFIG = {
  currency: {
    locale: 'es-AR',
    code: 'ARS',
    maximumFractionDigits: 0,
  },
  scanner: {
    maxScanFps: 15,
    cameraDelayMs: 300,
    videoFrameTimeoutMs: 1000,
  },
  ticket: {
    width: 800,
    baseHeight: 1100,
    rowHeight: 85,
    paddingHorizontal: 40,
    qrSize: 340,
  },
  ui: {
    pollingIntervalMs: 8000,
    hapticFeedbackDurationMs: 45,
  },
  categories: {
    tragos: { label: 'Tragos de Autor', iconName: 'Wine', color: 'text-purple-400', glow: 'shadow-purple-500/20' },
    cervezas: { label: 'Cervezas', iconName: 'Beer', color: 'text-amber-400', glow: 'shadow-amber-500/20' },
    combos: { label: 'Combos VIP', iconName: 'Sparkles', color: 'text-pink-400', glow: 'shadow-pink-500/20' },
    sin_alcohol: { label: 'Sin Alcohol', iconName: 'Droplets', color: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  },
} as const
