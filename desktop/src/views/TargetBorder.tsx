import { useEffect, useState } from 'react'
import type { Translations } from '../i18n/translations'
import { isTauri, onPreviewAction, tauriListen } from '../lib/tauri'
import { AEFlowMark } from '../components/Icons'

interface TargetBorderProps {
  t: Translations
  initialLabel?: string
}

interface BorderEventPayload {
  label?: string
  width?: number
  height?: number
}

export function TargetBorder({ t, initialLabel = 'Chrome — Q4 Revenue Dashboard' }: TargetBorderProps) {
  const [label, setLabel] = useState(initialLabel)

  useEffect(() => {
    let cleanup: (() => void) | undefined

    if (isTauri()) {
      void tauriListen<BorderEventPayload>('aeflow://border-update', (payload) => {
        if (payload.label) setLabel(payload.label)
      }).then((unlisten) => {
        cleanup = unlisten
      })
    } else {
      cleanup = onPreviewAction((action) => {
        if (action.type === 'border-update' && action.label) {
          setLabel(action.label)
        }
      })
    }

    return () => {
      cleanup?.()
    }
  }, [])

  const inNativeTauri = isTauri()

  return (
    <div
      className={
        inNativeTauri
          ? 'pointer-events-none select-none fixed inset-0 overflow-hidden'
          : 'pointer-events-none select-none relative h-[460px] w-full max-w-[780px] overflow-hidden rounded-xl bg-slate-900/45 shadow-2xl'
      }
      aria-hidden="true"
    >
      {/* Simulated inner app viewport chrome only when viewing inside Browser Preview */}
      {!inNativeTauri && (
        <div className="absolute inset-0 flex flex-col justify-between p-6 opacity-35">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            <div className="ml-3 h-4 w-52 rounded-md bg-slate-700/70" />
          </div>
          <div className="grid grid-cols-3 gap-4 my-auto">
            <div className="h-32 rounded-xl border border-white/10 bg-slate-800/60" />
            <div className="h-32 rounded-xl border border-white/10 bg-slate-800/60" />
            <div className="h-32 rounded-xl border border-white/10 bg-slate-800/60" />
          </div>
          <div className="h-6 w-40 rounded-md bg-slate-800/70" />
        </div>
      )}

      {/* 2px animated glowing indigo -> emerald perimeter frame */}
      <div
        className="aef-border-glow absolute inset-[1px] rounded-[10px]"
        style={{
          border: '2px solid transparent',
          background:
            'linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(34, 211, 238, 0.92), rgba(16, 185, 129, 0.95)) border-box',
          WebkitMask:
            'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          boxShadow:
            'inset 0 0 18px rgba(99, 102, 241, 0.22), 0 0 22px rgba(16, 185, 129, 0.22)',
        }}
      />

      {/* Precision corner highlight ticks */}
      <span className="absolute left-[1px] top-[1px] h-5 w-5 rounded-tl-[10px] border-l-2 border-t-2 border-cyan-300/95" />
      <span className="absolute right-[1px] top-[1px] h-5 w-5 rounded-tr-[10px] border-r-2 border-t-2 border-indigo-300/95" />
      <span className="absolute bottom-[1px] left-[1px] h-5 w-5 rounded-bl-[10px] border-b-2 border-l-2 border-indigo-300/95" />
      <span className="absolute bottom-[1px] right-[1px] h-5 w-5 rounded-br-[10px] border-b-2 border-r-2 border-emerald-300/95" />

      {/* Tiny unobtrusive top-left control pill */}
      <div className="absolute left-3 top-2.5 inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-emerald-400/35 bg-slate-950/82 px-2.5 py-1 text-[11px] font-medium text-slate-100 shadow-lg backdrop-blur-md">
        <span className="aef-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] shrink-0" />
        <AEFlowMark className="w-3 h-3 text-indigo-300 shrink-0" />
        <span className="whitespace-nowrap shrink-0 text-emerald-200">{t.borderControlling}</span>
        {label && (
          <>
            <span className="text-slate-600">·</span>
            <span className="truncate text-slate-300">{label}</span>
          </>
        )}
      </div>
    </div>
  )
}
