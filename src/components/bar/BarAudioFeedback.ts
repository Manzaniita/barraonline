/**
 * Sintetizador Web Audio API para alertas sonoras táctiles en barra
 * sin necesidad de cargar archivos de audio externos.
 */

class BarAudioFeedback {
  private ctx: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  /**
   * Beep agudo doble de éxito al escanear QR válido (<300ms)
   */
  playSuccess(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now) // A5
      osc.frequency.setValueAtTime(1760, now + 0.08) // A6

      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.22)
    } catch {}
  }

  /**
   * Zumbido grave de error ante QR inválido, agotado o vencido
   */
  playError(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, now) // A3
      osc.frequency.setValueAtTime(164, now + 0.12) // E3

      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    } catch {}
  }
}

export const barAudio = new BarAudioFeedback()
