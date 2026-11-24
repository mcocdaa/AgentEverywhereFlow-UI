import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  Check,
  Crosshair,
  Globe,
  LayoutGrid,
  Monitor,
  RefreshCw,
  Terminal,
  X,
} from 'lucide-react'
import { CopyCommandButton } from '../components/CopyCommandButton'
import { TargetTypeIcon } from '../components/Icons'
import type { Translations } from '../i18n/translations'
import { DEMO_TARGETS, desktopApi } from '../lib/api'
import { closePickerAndOpenCommand, getSelfPid, isTauri, tauriListen } from '../lib/tauri'
import type { CdpTargetInfo, Rect, TargetInfo } from '../lib/types'
import { useToolbarRoving } from '../lib/useToolbarRoving'

type PickerMode = 'hover' | 'grid' | 'cdp'

interface VisualPickerProps {
  t: Translations
  onToggleLocale: () => void
  daemonUrl?: string | null
}

interface ThumbnailCardProps {
  target: TargetInfo
  selected: boolean
  t: Translations
  daemonUrl?: string | null
  onToggle: (id: string) => void
  onBindDirect: (target: TargetInfo) => void
}

function ThumbnailCard({
  target,
  selected,
  t,
  daemonUrl,
  onToggle,
  onBindDirect,
}: ThumbnailCardProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const thumbUrl = daemonUrl
    ? `${daemonUrl.replace(/\/$/, '')}/api/v1/targets/${encodeURIComponent(target.target_id)}/thumbnail?width=360&quality=70`
    : desktopApi.getThumbnailUrl(target.target_id, 360)

  useEffect(() => {
    setImgFailed(false)
  }, [thumbUrl])

  return (
    <label
      onDoubleClick={(e) => {
        e.preventDefault()
        onBindDirect(target)
      }}
      className={`group aef-smooth-transition relative flex cursor-pointer flex-col overflow-hidden rounded-xl border p-2 select-none ${
        selected
          ? 'border-indigo-400/75 bg-indigo-500/15 shadow-[0_0_24px_rgba(99,102,241,0.22)]'
          : 'border-white/10 bg-slate-900/72 hover:border-white/25 hover:bg-slate-900/90'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(target.target_id)}
        className="sr-only"
      />

      {/* Thumbnail viewport preview */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-white/[0.07] bg-slate-950/90">
        {thumbUrl && !imgFailed ? (
          <img
            src={thumbUrl}
            alt={target.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col justify-between p-2.5 text-slate-600">
            <div className="flex items-center gap-1.5 pr-7">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
              <span className="ml-auto truncate font-mono text-[10px] text-slate-500">
                {target.process_name || target.target_type}
              </span>
            </div>
            <div className="mx-auto flex flex-col items-center gap-1 text-slate-500">
              <TargetTypeIcon type={target.target_type} className="w-6 h-6 text-indigo-400/65" />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>{target.target_id}</span>
              <span>
                {Math.round(target.rect.width)}×{Math.round(target.rect.height)}
              </span>
            </div>
          </div>
        )}

        {/* Selection check indicator */}
        <span
          aria-hidden="true"
          className={`aef-smooth-transition absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-md border ${
            selected
              ? 'border-indigo-300 bg-indigo-500 text-white'
              : 'border-white/25 bg-slate-950/70 text-transparent group-hover:border-white/45'
          }`}
        >
          <Check className="w-3 h-3" />
        </span>

        {target.is_minimized && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-950/85 px-1.5 py-0.5 text-[10px] text-slate-300">
            {t.pickerMinimizedBadge}
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <TargetTypeIcon type={target.target_type} className="w-3.5 h-3.5 text-cyan-300/85 shrink-0" />
          <span className="truncate text-xs font-medium text-slate-100">{target.title}</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap shrink-0">
          {Math.round(target.rect.width)}×{Math.round(target.rect.height)}
        </span>
      </div>
    </label>
  )
}

export function VisualPicker({ t, onToggleLocale, daemonUrl = null }: VisualPickerProps) {
  const [mode, setMode] = useState<PickerMode>('hover')
  const [targets, setTargets] = useState<TargetInfo[]>([])
  const [cdpTargets, setCdpTargets] = useState<CdpTargetInfo[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [loadingCdp, setLoadingCdp] = useState(false)

  // Hover & Drag-Region state
  const [hoveredTarget, setHoveredTarget] = useState<TargetInfo | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)

  // Multi-select Grid state
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selfPidRef = useRef<number | null>(null)
  const lastProbeAtRef = useRef<number>(0)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const inNativeTauri = isTauri()

  useToolbarRoving(toolbarRef)

  const refreshTargets = useCallback(async () => {
    setLoadingTargets(true)
    try {
      const list = await desktopApi.listTargets()
      setTargets(list)
    } finally {
      setLoadingTargets(false)
    }
  }, [])

  const refreshCdp = useCallback(async () => {
    setLoadingCdp(true)
    try {
      const list = await desktopApi.listCdpTargets()
      setCdpTargets(list)
    } finally {
      setLoadingCdp(false)
    }
  }, [])

  useEffect(() => {
    void getSelfPid().then((pid) => {
      selfPidRef.current = pid
    })
  }, [])

  useEffect(() => {
    if (daemonUrl) {
      desktopApi.setBaseUrl(daemonUrl)
    }
    void refreshTargets()
    void refreshCdp()
  }, [daemonUrl, refreshTargets, refreshCdp])

  // Refresh targets/CDP whenever the native picker window is re-opened
  useEffect(() => {
    if (!inNativeTauri) return
    let active = true
    let unlisten: (() => void) | undefined
    void tauriListen<void>('aeflow://picker-opened', () => {
      setSelectedIds([])
      setHoveredTarget(null)
      setDragStart(null)
      setDragCurrent(null)
      void refreshTargets()
      void refreshCdp()
    }).then((fn) => {
      if (!active) {
        fn()
      } else {
        unlisten = fn
      }
    })
    return () => {
      active = false
      unlisten?.()
    }
  }, [inNativeTauri, refreshTargets, refreshCdp])

  // Keyboard shortcuts: Esc to exit, Tab to toggle Hover <-> Grid
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        void closePickerAndOpenCommand(null)
        return
      }
      if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const tag = (event.target as HTMLElement | null)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        event.preventDefault()
        setMode((prev) => (prev === 'hover' ? 'grid' : prev === 'grid' ? 'hover' : 'grid'))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const dragRect: Rect | null = useMemo(() => {
    if (!dragStart || !dragCurrent) return null
    const x = Math.min(dragStart.x, dragCurrent.x)
    const y = Math.min(dragStart.y, dragCurrent.y)
    const width = Math.abs(dragCurrent.x - dragStart.x)
    const height = Math.abs(dragCurrent.y - dragStart.y)
    if (width < 8 && height < 8) return null
    return { x, y, width, height }
  }, [dragStart, dragCurrent])

  // Throttled (60ms) cursor hit-testing in Hover & Drag-Region mode
  const handleCanvasMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (mode !== 'hover') return

      if (dragStart) {
        setDragCurrent({ x: event.clientX, y: event.clientY })
        return
      }

      const now = performance.now()
      if (now - lastProbeAtRef.current < 60) return
      lastProbeAtRef.current = now

      const probeX = inNativeTauri ? event.screenX : event.clientX
      const probeY = inNativeTauri ? event.screenY : event.clientY

      void desktopApi
        .targetAtPoint(probeX, probeY, selfPidRef.current)
        .then((hit) => {
          setHoveredTarget(hit)
        })
        .catch(() => {})
    },
    [mode, dragStart, inNativeTauri],
  )

  const handleCanvasMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'hover' || event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-picker-chrome]')) return
    setDragStart({ x: event.clientX, y: event.clientY })
    setDragCurrent({ x: event.clientX, y: event.clientY })
  }

  const handleCanvasMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'hover' || !dragStart) return

    const dx = Math.abs(event.clientX - dragStart.x)
    const dy = Math.abs(event.clientY - dragStart.y)

    if (dx >= 10 && dy >= 10) {
      // Custom Region crop created!
      const rx = Math.round(Math.min(dragStart.x, event.clientX))
      const ry = Math.round(Math.min(dragStart.y, event.clientY))
      const rw = Math.round(dx)
      const rh = Math.round(dy)
      const screenOffsetX = inNativeTauri ? window.screenX : 0
      const screenOffsetY = inNativeTauri ? window.screenY : 0
      const physX = rx + screenOffsetX
      const physY = ry + screenOffsetY

      const regionTitle = `${t.pickerRegionCustomTitle} (${rw}×${rh})`
      const regionTarget: TargetInfo = {
        target_id: `region:${physX},${physY},${rw},${rh}`,
        target_type: 'region',
        title: regionTitle,
        native_handle: 0,
        process_name: 'region',
        is_minimized: false,
        rect: { x: physX, y: physY, width: rw, height: rh },
      }
      setDragStart(null)
      setDragCurrent(null)
      void closePickerAndOpenCommand({
        targets: [regionTarget],
        region: {
          x: physX,
          y: physY,
          width: rw,
          height: rh,
          title: regionTitle,
          parent_target_id: hoveredTarget?.target_id,
        },
      })
      return
    }

    setDragStart(null)
    setDragCurrent(null)

    if (hoveredTarget) {
      void closePickerAndOpenCommand({ targets: [hoveredTarget] })
    }
  }

  const toggleGridSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const bindSelectedGridTargets = () => {
    const chosen = targets.filter((item) => selectedIds.includes(item.target_id))
    if (chosen.length === 0) return
    void closePickerAndOpenCommand({ targets: chosen })
  }

  const bindCdpTab = (tab: CdpTargetInfo) => {
    const asTarget: TargetInfo = {
      target_id: tab.target_id || `cdp:${tab.id}`,
      target_type: 'cdp',
      title: tab.title || tab.url,
      native_handle: 0,
      process_name: 'CDP Browser',
      is_minimized: false,
      rect: { x: 0, y: 0, width: 1280, height: 800 },
      cdp_ws_url: tab.ws_url,
      url: tab.url,
    }
    void closePickerAndOpenCommand({
      targets: [asTarget],
      cdpTarget: tab,
    })
  }

  const displayTargets = useMemo(
    () => targets.filter((item) => item.target_type === 'display'),
    [targets],
  )
  const windowTargets = useMemo(
    () => targets.filter((item) => item.target_type !== 'display'),
    [targets],
  )

  return (
    <div
      onMouseMove={handleCanvasMouseMove}
      onMouseDown={handleCanvasMouseDown}
      onMouseUp={handleCanvasMouseUp}
      className={`fixed inset-0 select-none overflow-hidden ${
        mode === 'hover'
          ? 'cursor-crosshair bg-slate-950/32'
          : 'cursor-default bg-slate-950/78 backdrop-blur-md'
      }`}
    >
      {/* Browser-preview mock desktop windows underneath Hover canvas so hover/snap works interactively */}
      {!inNativeTauri && mode === 'hover' && (
        <div className="pointer-events-none fixed inset-0">
          {DEMO_TARGETS.filter((item) => item.target_type === 'window' && !item.is_minimized).map(
            (win) => (
              <div
                key={win.target_id}
                style={{
                  transform: `translate3d(${win.rect.x}px, ${win.rect.y}px, 0)`,
                  width: Math.min(win.rect.width, 620),
                  height: Math.min(win.rect.height, 400),
                }}
                className="absolute left-0 top-0 rounded-xl border border-white/10 bg-slate-900/55 p-3 shadow-2xl"
              >
                <div className="flex items-center gap-1.5 border-b border-white/[0.06] pb-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-slate-600" />
                  <span className="h-2 w-2 rounded-full bg-slate-600" />
                  <span className="h-2 w-2 rounded-full bg-slate-600" />
                  <span className="ml-2 truncate font-medium text-slate-300">{win.title}</span>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Top Floating Frosted Glass Segmented Switcher */}
      <div
        data-picker-chrome
        className="pointer-events-auto fixed left-1/2 top-5 z-40 -translate-x-1/2"
      >
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label={t.pickerToolbarAria}
          {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
          className="aef-glass-subtle flex items-center gap-1 rounded-full px-2 py-1.5"
        >
          <div role="group" aria-label={t.pickerToolbarAria} className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={mode === 'hover'}
              onClick={() => setMode('hover')}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white"
            >
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.pickerModeHover}</span>
            </button>

            <button
              type="button"
              aria-pressed={mode === 'grid'}
              onClick={() => setMode('grid')}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white"
            >
              <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.pickerModeGrid}</span>
            </button>

            <button
              type="button"
              aria-pressed={mode === 'cdp'}
              onClick={() => {
                setMode('cdp')
                void refreshCdp()
              }}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.pickerModeCdp}</span>
            </button>
          </div>

          <span
            role="separator"
            aria-orientation="vertical"
            className="mx-1 h-4 border-l border-white/12"
          />

          <button
            type="button"
            data-action="toggle-locale"
            data-testid="locale-toggle"
            aria-label={t.localeSwitchAria}
            title={t.localeSwitchAria}
            onClick={onToggleLocale}
            className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{t.localeSwitchLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => void closePickerAndOpenCommand(null)}
            className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/12 hover:text-white"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.pickerEscHint}</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Hover Highlight & Custom Drag-Region Selection */}
      {mode === 'hover' && (
        <>
          {/* Hovered OS window highlight box */}
          {hoveredTarget && !dragRect && (
            <div
              style={{
                transform: `translate3d(${hoveredTarget.rect.x}px, ${hoveredTarget.rect.y}px, 0)`,
                width: inNativeTauri
                  ? hoveredTarget.rect.width
                  : Math.min(hoveredTarget.rect.width, 620),
                height: inNativeTauri
                  ? hoveredTarget.rect.height
                  : Math.min(hoveredTarget.rect.height, 400),
              }}
              className="pointer-events-none fixed left-0 top-0 z-20 rounded-xl border-2 border-cyan-400/90 bg-indigo-500/12 shadow-[0_0_32px_rgba(34,211,238,0.28)] transition-[transform,width,height] duration-75 ease-out"
            >
              {/* Floating Window Identity Pill (docks inside when near top monitor edge/toolbar) */}
              <div
                className={`absolute inline-flex max-w-[420px] items-center gap-1.5 rounded-full border border-cyan-300/40 bg-slate-950/90 px-3 py-1 text-xs font-medium text-slate-100 shadow-xl backdrop-blur-md ${
                  hoveredTarget.rect.y < 110 ? 'left-3 top-3' : '-top-9 left-0'
                }`}
              >
                <TargetTypeIcon
                  type={hoveredTarget.target_type}
                  className="w-3.5 h-3.5 text-cyan-300 shrink-0"
                />
                <span className="truncate">{hoveredTarget.title}</span>
                <span className="text-slate-500 shrink-0">·</span>
                <span className="font-mono text-[11px] text-cyan-200 whitespace-nowrap shrink-0">
                  {Math.round(hoveredTarget.rect.width)}×{Math.round(hoveredTarget.rect.height)}
                </span>
              </div>
            </div>
          )}

          {/* Custom Drag-Region Crop Box */}
          {dragRect && (
            <div
              style={{
                transform: `translate3d(${dragRect.x}px, ${dragRect.y}px, 0)`,
                width: dragRect.width,
                height: dragRect.height,
              }}
              className="pointer-events-none fixed left-0 top-0 z-30 rounded-lg border-2 border-emerald-400 bg-emerald-400/12 shadow-[0_0_28px_rgba(16,185,129,0.3)]"
            >
              <div className="absolute -top-8 left-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/45 bg-slate-950/92 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-200 shadow-lg whitespace-nowrap">
                <span>{t.pickerDragRegionLabel}</span>
                <span>·</span>
                <span>
                  {Math.round(dragRect.width)} × {Math.round(dragRect.height)}
                </span>
              </div>
            </div>
          )}

          {/* Minimal Bottom Helper Pill */}
          <div
            data-picker-chrome
            className="pointer-events-none fixed bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/78 px-4 py-1.5 text-xs text-slate-300 shadow-lg backdrop-blur-md whitespace-nowrap"
          >
            {t.pickerHoverGuide}
          </div>
        </>
      )}

      {/* Mode 2: Zoom Thumbnail Grid (Tab) */}
      {mode === 'grid' && (
        <div
          data-picker-chrome
          className="aef-fade-in fixed inset-0 overflow-y-auto px-8 pb-28 pt-24"
        >
          <div className="mx-auto max-w-5xl space-y-6">
            {loadingTargets && targets.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-400">{t.pickerLoading}</div>
            ) : targets.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-400">{t.pickerEmptyTargets}</div>
            ) : (
              <>
                {displayTargets.length > 0 && (
                  <section aria-label={t.pickerDisplaysSection}>
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Monitor className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                      <span>{t.pickerDisplaysSection}</span>
                      <span className="text-slate-600">({displayTargets.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                      {displayTargets.map((item) => (
                        <ThumbnailCard
                          key={item.target_id}
                          target={item}
                          selected={selectedIds.includes(item.target_id)}
                          t={t}
                          daemonUrl={daemonUrl}
                          onToggle={toggleGridSelection}
                          onBindDirect={(tgt) => void closePickerAndOpenCommand({ targets: [tgt] })}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {windowTargets.length > 0 && (
                  <section aria-label={t.pickerWindowsSection}>
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                      <span>{t.pickerWindowsSection}</span>
                      <span className="text-slate-600">({windowTargets.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                      {windowTargets.map((item) => (
                        <ThumbnailCard
                          key={item.target_id}
                          target={item}
                          selected={selectedIds.includes(item.target_id)}
                          t={t}
                          daemonUrl={daemonUrl}
                          onToggle={toggleGridSelection}
                          onBindDirect={(tgt) => void closePickerAndOpenCommand({ targets: [tgt] })}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Multi-Select Floating Confirm Bar */}
          {selectedIds.length > 0 && (
            <div className="aef-fade-in fixed bottom-16 left-1/2 z-40 -translate-x-1/2">
              <div className="aef-glass flex items-center gap-3 rounded-full px-4 py-2">
                <span className="text-xs text-slate-200 whitespace-nowrap">
                  {t.pickerSelectedCount}{' '}
                  <strong className="font-semibold text-indigo-300">{selectedIds.length}</strong>{' '}
                  {t.targetCountSuffix}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-slate-400 hover:text-slate-200 whitespace-nowrap"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={bindSelectedGridTargets}
                  className="aef-smooth-transition inline-flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-400 whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.pickerBindSelected}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Headless Browser CDP Tabs */}
      {mode === 'cdp' && (
        <div
          data-picker-chrome
          className="aef-fade-in fixed inset-0 overflow-y-auto px-6 pb-24 pt-24"
        >
          <div className="mx-auto max-w-2xl">
            <div className="aef-glass overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                  <h2 className="text-sm font-medium text-slate-100">{t.pickerCdpTitle}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshCdp()}
                  disabled={loadingCdp}
                  className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCdp ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{t.pickerCdpRefresh}</span>
                </button>
              </div>

              {cdpTargets.length > 0 ? (
                <div className="divide-y divide-white/[0.07]">
                  {cdpTargets.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => bindCdpTab(tab)}
                      className="aef-smooth-transition flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/[0.06]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">
                          {tab.title || tab.url}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                          {tab.url}
                        </div>
                      </div>
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 whitespace-nowrap shrink-0">
                        {t.pickerCdpBackgroundBadge}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <Globe className="mx-auto mb-3 h-7 w-7 text-slate-500" aria-hidden="true" />
                  <h3 className="text-sm font-medium text-slate-200">{t.pickerCdpEmptyTitle}</h3>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                    {t.pickerCdpEmptyDesc}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs">
                    <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                    <code className="font-mono text-cyan-200">{t.pickerCdpLaunchHint}</code>
                    <CopyCommandButton
                      text={t.pickerCdpLaunchHint}
                      ariaLabel={t.copyCommandAria}
                      copiedLabel={t.copied}
                      failedLabel={t.copyFailed}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
