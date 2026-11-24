import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Copy } from 'lucide-react'

interface CopyCommandButtonProps {
  text: string
  ariaLabel: string
  copiedLabel: string
  failedLabel: string
  className?: string
}

let lastAnnouncement = ''

function legacyCopyFallback(text: string): boolean {
  const previousFocus = document.activeElement as HTMLElement | null
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0;pointer-events:none'
  document.body.append(field)
  field.select()
  try {
    return document.execCommand('copy')
  } finally {
    field.remove()
    previousFocus?.focus({ preventScroll: true })
  }
}

export function CopyCommandButton({
  text,
  ariaLabel,
  copiedLabel,
  failedLabel,
  className = '',
}: CopyCommandButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [liveText, setLiveText] = useState('')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const report = useCallback(
    (ok: boolean) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      setStatus(ok ? 'copied' : 'failed')

      let msg = ok ? copiedLabel : failedLabel
      if (msg === lastAnnouncement) {
        msg += '\u00A0'
      }
      lastAnnouncement = msg
      setLiveText('')
      requestAnimationFrame(() => setLiveText(msg))

      timerRef.current = window.setTimeout(() => {
        setStatus('idle')
        setLiveText('')
        timerRef.current = null
      }, 2000)
    },
    [copiedLabel, failedLabel],
  )

  const handleCopy = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(trimmed)
        report(true)
        return
      }
      report(legacyCopyFallback(trimmed))
    } catch {
      report(legacyCopyFallback(trimmed))
    }
  }, [text, report])

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={ariaLabel}
        title={ariaLabel}
        data-copied={status === 'copied' ? '' : undefined}
        data-failed={status === 'failed' ? '' : undefined}
        className="aef-toolbar-btn aef-smooth-transition inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
      >
        {status === 'copied' ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
        ) : status === 'failed' ? (
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
        ) : (
          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
        )}
      </button>
      <span
        role="status"
        className={`pointer-events-none absolute -top-7 right-0 whitespace-nowrap rounded-md border border-white/12 bg-slate-900/95 px-2 py-0.5 text-[11px] font-medium shadow-lg aef-smooth-transition ${
          status === 'idle' ? 'opacity-0' : 'opacity-100'
        } ${status === 'failed' ? 'text-rose-300' : 'text-emerald-300'}`}
      >
        {liveText}
      </span>
    </span>
  )
}
