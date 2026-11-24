import { useEffect, useState } from 'react'
import { useLocale } from './i18n/useLocale'
import { isTauri, onPreviewAction } from './lib/tauri'
import type { DesktopView, PendingApproval, PickerSelectionPayload } from './lib/types'
import { CommandPopup } from './views/CommandPopup'
import { StatusPill } from './views/StatusPill'
import { TargetBorder } from './views/TargetBorder'
import { VisualPicker } from './views/VisualPicker'

function readInitialView(): DesktopView {
  if (typeof window === 'undefined') return 'command'
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('view') || window.location.hash.replace(/^#\/?/, '')
  if (raw === 'picker' || raw === 'border' || raw === 'pill' || raw === 'command') {
    return raw
  }
  return 'command'
}

export function App() {
  const { locale, t, toggleLocale } = useLocale()
  const [view, setView] = useState<DesktopView>(readInitialView)
  const [previewSelection, setPreviewSelection] = useState<PickerSelectionPayload | null>(null)
  const [simMissingBackend, setSimMissingBackend] = useState(false)
  const [simPillApproval, setSimPillApproval] = useState<PendingApproval | null>(null)

  const inNativeTauri = isTauri()

  useEffect(() => {
    if (inNativeTauri) return
    return onPreviewAction((action) => {
      if (action.type === 'switch-view') {
        setView(action.view)
      } else if (action.type === 'target-selected') {
        setPreviewSelection(action.payload)
      }
    })
  }, [inNativeTauri])

  // Native Tauri multi-window mode: render the dedicated transparent view directly with zero wrapper chrome
  if (inNativeTauri) {
    switch (view) {
      case 'picker':
        return <VisualPicker t={t} onToggleLocale={toggleLocale} />
      case 'border':
        return <TargetBorder t={t} />
      case 'pill':
        return <StatusPill t={t} />
      case 'command':
      default:
        return (
          <CommandPopup
            t={t}
            locale={locale}
            onToggleLocale={toggleLocale}
          />
        )
    }
  }

  // Plain Browser Preview mode (`npm run dev`): interactive showcase for all 4 views
  return (
    <div className="aef-preview-canvas relative min-h-screen w-full overflow-hidden">
      {view === 'picker' && <VisualPicker t={t} onToggleLocale={toggleLocale} />}

      {view === 'command' && (
        <main className="flex min-h-screen w-full items-start justify-center px-4 pt-24 pb-24">
          <CommandPopup
            t={t}
            locale={locale}
            onToggleLocale={toggleLocale}
            simulateMissingBackend={simMissingBackend}
            initialSelection={previewSelection}
            onSelectionChange={setPreviewSelection}
          />
        </main>
      )}

      {view === 'border' && (
        <main className="flex min-h-screen w-full items-center justify-center px-6 py-16">
          <TargetBorder
            t={t}
            initialLabel={previewSelection?.targets[0]?.title || 'Chrome — Q4 Revenue Dashboard'}
          />
        </main>
      )}

      {view === 'pill' && (
        <main className="flex min-h-screen w-full items-start justify-center px-4 pt-8">
          <StatusPill
            t={t}
            initialLabel={previewSelection?.targets[0]?.title || 'Chrome — Q4 Revenue Dashboard'}
            simulatedApproval={simPillApproval}
            onClearSimulatedApproval={() => setSimPillApproval(null)}
          />
        </main>
      )}

      {/* Subtle Browser-Only Dev View Switcher */}
      <nav
        aria-label={t.previewBadge}
        className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
      >
        <div className="aef-glass-subtle flex items-center gap-1 rounded-full px-2 py-1 text-[11px]">
          <span className="px-2 font-medium text-slate-400 whitespace-nowrap shrink-0">
            {t.previewBadge}
          </span>
          {(
            [
              ['command', t.previewViewCommand],
              ['picker', t.previewViewPicker],
              ['border', t.previewViewBorder],
              ['pill', t.previewViewPill],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`aef-smooth-transition rounded-full px-2.5 py-1 font-medium whitespace-nowrap shrink-0 ${
                view === v
                  ? 'bg-indigo-500/30 text-indigo-100 ring-1 ring-inset ring-indigo-400/45'
                  : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}

          {view === 'command' && (
            <button
              type="button"
              aria-pressed={simMissingBackend}
              onClick={() => setSimMissingBackend((prev) => !prev)}
              className={`aef-smooth-transition ml-1 rounded-full border px-2.5 py-1 font-medium whitespace-nowrap shrink-0 ${
                simMissingBackend
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.previewSimMissingBackend}
            </button>
          )}

          {view === 'pill' && (
            <button
              type="button"
              aria-pressed={Boolean(simPillApproval)}
              onClick={() =>
                setSimPillApproval((prev) =>
                  prev
                    ? null
                    : {
                        action: 'click',
                        code_snippet: 'click(820, 412)',
                        description:
                          locale === 'zh-CN'
                            ? '点击「确认提交」按钮 (820, 412)'
                            : 'Click "Confirm Submit" button (820, 412)',
                      },
                )
              }
              className={`aef-smooth-transition ml-1 rounded-full border px-2.5 py-1 font-medium whitespace-nowrap shrink-0 ${
                simPillApproval
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.previewSimApproval}
            </button>
          )}
        </div>
      </nav>
    </div>
  )
}
export default App
