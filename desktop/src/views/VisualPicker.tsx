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
import {
  closePickerAndOpenCommand,
  getPickerGeometry,
  getSelfPid,
  isTauri,
  tauriListen,
  type PickerGeometry,
} from '../lib/tauri'
import type { CdpTargetInfo, Rect, TargetInfo } from '../lib/types'
import { useToolbarRoving } from '../lib/useToolbarRoving'

type PickerMode = 'hover' | 'grid' | 'cdp'

interface VisualPickerProps {
  t: Translations
  onToggleLocale: () => void
  daemonUrl?: string | null
}

const SELF_OVERLAY_TITLES = new Set([
  'AEFlow Target Picker',
  'AEFlow Target Border',
  'AEFlow Status Pill',
])

function isSelfOverlayTarget(target: TargetInfo, selfPid: number | null): boolean {
  if (selfPid !== null && target.pid != null && target.pid === selfPid) return true
  const proc = (target.process_name || '').trim().toLowerCase()
  if (proc === 'aeflow desktop' || proc === 'aeflow-desktop') return true
  if (SELF_OVERLAY_TITLES.has(target.title)) return true
  return false
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

function clientToOsPoint(
  clientX: number,
  clientY: number,
  geom: PickerGeometry | null,
  inNativeTauri: boolean,
): { x: number; y: number } {
  if (!inNativeTauri || !geom) {
    return { x: Math.round(clientX), y: Math.round(clientY) }
  }
  if (geom.os_coord_space === 'logical') {
    return {
      x: Math.round(geom.logical_x + clientX),
      y: Math.round(geom.logical_y + clientY),
    }
  }
  const scale = geom.scale_factor || 1
  return {
    x: Math.round(geom.physical_x + clientX * scale),
    y: Math.round(geom.physical_y + clientY * scale),
  }
}

function clientRectToOsRect(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  geom: PickerGeometry | null,
  inNativeTauri: boolean,
): Rect {
  if (!inNativeTauri || !geom) {
    return {
      x: Math.round(rx),
      y: Math.round(ry),
      width: Math.round(rw),
      height: Math.round(rh),
    }
  }
  if (geom.os_coord_space === 'logical') {
    return {
      x: Math.round(geom.logical_x + rx),
      y: Math.round(geom.logical_y + ry),
      width: Math.round(rw),
      height: Math.round(rh),
    }
  }
  const scale = geom.scale_factor || 1
  return {
    x: Math.round(geom.physical_x + rx * scale),
    y: Math.round(geom.physical_y + ry * scale),
    width: Math.round(rw * scale),
    height: Math.round(rh * scale),
  }
}

function osRectToCss(rect: Rect, geom: PickerGeometry | null, inNativeTauri: boolean): Rect {
  if (!inNativeTauri || !geom) {
    return {
      x: rect.x,
      y: rect.y,
      width: inNativeTauri ? rect.width : Math.min(rect.width, 620),
      height: inNativeTauri ? rect.height : Math.min(rect.height, 400),
    }
  }
  if (geom.os_coord_space === 'logical') {
    return {
      x: rect.x - geom.logical_x,
      y: rect.y - geom.logical_y,
      width: rect.width,
      height: rect.height,
    }
  }
  const scale = geom.scale_factor || 1
  return {
    x: (rect.x - geom.physical_x) / scale,
    y: (rect.y - geom.physical_y) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  }
}

function findTargetAtOsPoint(
  targets: TargetInfo[],
  osX: number,
  osY: number,
  selfPid: number | null,
  inNativeTauri: boolean,
): TargetInfo | null {
  // 1. Check non-minimized window targets first (preserving front-to-back OS order)
  for (const target of targets) {
    if (target.target_type !== 'window' || target.is_minimized) continue
    if (isSelfOverlayTarget(target, selfPid)) continue
    const effectiveRect: Rect = inNativeTauri
      ? target.rect
      : {
          x: target.rect.x,
          y: target.rect.y,
          width: Math.min(target.rect.width, 620),
          height: Math.min(target.rect.height, 400),
        }
    if (pointInRect(osX, osY, effectiveRect)) {
      return target
    }
  }
  // 2. Fall back to display targets containing (osX, osY)
  for (const target of targets) {
    if (target.target_type !== 'display') continue
    if (pointInRect(osX, osY, target.rect)) {
      return target
    }
  }
  return null
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
    <div
      role="checkbox"
      tabIndex={0}
      aria-checked={selected}
      onClick={() => onToggle(target.target_id)}
      onDoubleClick={(e) => {
        e.preventDefault()
        onBindDirect(target)
      }}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault()
          onToggle(target.target_id)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          onBindDirect(target)
        }
      }}
      className={`group aef-smooth-transition relative flex cursor-pointer flex-col overflow-hidden rounded-xl border p-2 select-none ${
        selected
          ? 'border-indigo-400/75 bg-indigo-500/15 shadow-[0_0_24px_rgba(99,102,241,0.22)]'
          : 'border-white/10 bg-slate-900/72 hover:border-white/25 hover:bg-slate-900/90'
      }`}
    >
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

        {/* Effortless 1-click Bind pill button on hover/focus */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onBindDirect(target)
          }}
          className="aef-smooth-transition absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full border border-indigo-300/50 bg-indigo-500/90 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg backdrop-blur-sm hover:bg-indigo-400 focus:opacity-100 group-hover:opacity-100"
        >
          <Check className="w-3 h-3" aria-hidden="true" />
          <span>{t.pickerQuickBind}</span>
        </button>
      </div>

      {/* Metadata row */}
      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <TargetTypeIcon
            type={target.target_type}
            className="w-3.5 h-3.5 text-cyan-300/85 shrink-0"
          />
          <span className="truncate text-xs font-medium text-slate-100">{target.title}</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap shrink-0">
          {Math.round(target.rect.width)}×{Math.round(target.rect.height)}
        </span>
      </div>
    </div>
  )
}

export function VisualPicker({ t, onToggleLocale, daemonUrl = null }: VisualPickerProps) {
  const [mode, setMode] = useState<PickerMode>('hover')
  const [targets, setTargets] = useState<TargetInfo[]>([])
  const [cdpTargets, setCdpTargets] = useState<CdpTargetInfo[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [loadingCdp, setLoadingCdp] = useState(false)
  const [selfPid, setSelfPid] = useState<number | null>(null)
  const [pickerGeom, setPickerGeom] = useState<PickerGeometry | null>(null)

  // Hover & Drag-Region state
  const [hoveredTarget, setHoveredTarget] = useState<TargetInfo | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)

  // Multi-select Grid state
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selfPidRef = useRef<number | null>(null)
  const pickerGeomRef = useRef<PickerGeometry | null>(null)
  const targetsRef = useRef<TargetInfo[]>([])
  const hoveredTargetRef = useRef<TargetInfo | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastProbeAtRef = useRef<number>(0)
  const probeSeqRef = useRef<number>(0)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const inNativeTauri = isTauri()

  targetsRef.current = targets
  hoveredTargetRef.current = hoveredTarget

  const updatePickerGeom = useCallback((geom: PickerGeometry | null) => {
    pickerGeomRef.current = geom
    setPickerGeom(geom)
  }, [])

  useToolbarRoving(toolbarRef)

  const refreshTargets = useCallback(async () => {
    setLoadingTargets(true)
    try {
      const list = await desktopApi.listTargets()
      targetsRef.current = list
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
      setSelfPid(pid)
    })
    if (inNativeTauri) {
      void getPickerGeometry().then((geom) => {
        if (geom) updatePickerGeom(geom)
      })
    }
  }, [inNativeTauri, updatePickerGeom])

  useEffect(() => {
    if (daemonUrl) {
      desktopApi.setBaseUrl(daemonUrl)
    }
    void refreshTargets()
    void refreshCdp()
  }, [daemonUrl, refreshTargets, refreshCdp])

  // Refresh targets/CDP & live window geometry whenever the native picker window is re-opened
  useEffect(() => {
    if (!inNativeTauri) return
    let active = true
    let unlisten: (() => void) | undefined
    void tauriListen<PickerGeometry | null>('aeflow://picker-opened', (payload) => {
      if (payload && typeof payload === 'object' && 'os_coord_space' in payload) {
        updatePickerGeom(payload)
      } else {
        void getPickerGeometry().then((geom) => {
          if (active && geom) updatePickerGeom(geom)
        })
      }
      setSelectedIds([])
      setHoveredTarget(null)
      hoveredTargetRef.current = null
      setDragStart(null)
      dragStartRef.current = null
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
  }, [inNativeTauri, refreshTargets, refreshCdp, updatePickerGeom])

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
    if (Math.hypot(width, height) < 12 || width < 8 || height < 8) return null
    return { x, y, width, height }
  }, [dragStart, dragCurrent])

  const dragOsRect: Rect | null = useMemo(() => {
    if (!dragRect) return null
    return clientRectToOsRect(
      dragRect.x,
      dragRect.y,
      dragRect.width,
      dragRect.height,
      pickerGeom,
      inNativeTauri,
    )
  }, [dragRect, pickerGeom, inNativeTauri])

  const hoveredCssRect: Rect | null = useMemo(() => {
    if (!hoveredTarget) return null
    return osRectToCss(hoveredTarget.rect, pickerGeom, inNativeTauri)
  }, [hoveredTarget, pickerGeom, inNativeTauri])

  // Instant local hit-test + throttled (60ms) backend z-order refinement in Hover & Drag-Region mode
  const handleCanvasMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (mode !== 'hover') return

      if (dragStartRef.current) {
        setDragCurrent({ x: event.clientX, y: event.clientY })
        return
      }

      if ((event.target as HTMLElement).closest('[data-picker-chrome]')) return

      const osPt = clientToOsPoint(
        event.clientX,
        event.clientY,
        pickerGeomRef.current,
        inNativeTauri,
      )

      // Zero-latency local hit-test so highlight appears immediately on cursor entry
      const localHit = findTargetAtOsPoint(
        targetsRef.current,
        osPt.x,
        osPt.y,
        selfPidRef.current,
        inNativeTauri,
      )
      if (localHit) {
        hoveredTargetRef.current = localHit
        setHoveredTarget((prev) => (prev?.target_id === localHit.target_id ? prev : localHit))
      }

      const now = performance.now()
      if (now - lastProbeAtRef.current < 60) return
      lastProbeAtRef.current = now

      const seq = ++probeSeqRef.current
      void desktopApi
        .targetAtPoint(osPt.x, osPt.y, selfPidRef.current)
        .then((hit) => {
          if (seq !== probeSeqRef.current || dragStartRef.current) return
          if (hit && !isSelfOverlayTarget(hit, selfPidRef.current)) {
            hoveredTargetRef.current = hit
            setHoveredTarget((prev) => (prev?.target_id === hit.target_id ? prev : hit))
          }
        })
        .catch(() => {})
    },
    [mode, inNativeTauri],
  )

  const handleCanvasMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'hover' || event.button !== 0) return
    if ((event.target as HTMLElement).closest('[data-picker-chrome]')) return
    const pt = { x: event.clientX, y: event.clientY }
    dragStartRef.current = pt
    setDragStart(pt)
    setDragCurrent(pt)
  }

  const handleCanvasMouseUp = async (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'hover' || !dragStartRef.current) return

    const start = dragStartRef.current
    const dx = Math.abs(event.clientX - start.x)
    const dy = Math.abs(event.clientY - start.y)
    const dragDist = Math.hypot(dx, dy)

    dragStartRef.current = null
    setDragStart(null)
    setDragCurrent(null)

    if (dragDist >= 12 && dx >= 8 && dy >= 8) {
      // Custom Region crop created in exact OS coordinates (logical on macOS, physical on Win/Linux)
      const rx = Math.min(start.x, event.clientX)
      const ry = Math.min(start.y, event.clientY)
      const osRect = clientRectToOsRect(rx, ry, dx, dy, pickerGeomRef.current, inNativeTauri)

      const regionTitle = `${t.pickerRegionCustomTitle} (${osRect.width}×${osRect.height})`
      const regionTarget: TargetInfo = {
        target_id: `region:${osRect.x},${osRect.y},${osRect.width},${osRect.height}`,
        target_type: 'region',
        title: regionTitle,
        native_handle: 0,
        process_name: 'region',
        is_minimized: false,
        rect: osRect,
      }
      await closePickerAndOpenCommand({
        targets: [regionTarget],
        region: {
          x: osRect.x,
          y: osRect.y,
          width: osRect.width,
          height: osRect.height,
          title: regionTitle,
          parent_target_id: hoveredTargetRef.current?.target_id,
        },
      })
      return
    }

    // Click: bind hovered window/display reliably (local fallback + one-shot backend probe if needed)
    const osPt = clientToOsPoint(
      event.clientX,
      event.clientY,
      pickerGeomRef.current,
      inNativeTauri,
    )
    let chosen =
      hoveredTargetRef.current ??
      findTargetAtOsPoint(
        targetsRef.current,
        osPt.x,
        osPt.y,
        selfPidRef.current,
        inNativeTauri,
      )

    if (!chosen) {
      try {
        const hit = await desktopApi.targetAtPoint(osPt.x, osPt.y, selfPidRef.current)
        if (hit && !isSelfOverlayTarget(hit, selfPidRef.current)) {
          chosen = hit
        }
      } catch {
        // ignore transient lookup error
      }
    }

    if (chosen) {
      await closePickerAndOpenCommand({ targets: [chosen] })
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
    () =>
      targets.filter(
        (item) => item.target_type !== 'display' && !isSelfOverlayTarget(item, selfPid),
      ),
    [targets, selfPid],
  )

  return (
    <div
      onMouseMove={handleCanvasMouseMove}
      onMouseDown={handleCanvasMouseDown}
      onMouseUp={(e) => void handleCanvasMouseUp(e)}
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
          {/* Hovered OS window highlight box (aligned pixel-for-pixel via osRectToCss) */}
          {hoveredTarget && hoveredCssRect && !dragRect && (
            <div
              style={{
                transform: `translate3d(${hoveredCssRect.x}px, ${hoveredCssRect.y}px, 0)`,
                width: hoveredCssRect.width,
                height: hoveredCssRect.height,
              }}
              className="pointer-events-none fixed left-0 top-0 z-20 rounded-xl border-2 border-cyan-400/90 bg-indigo-500/12 shadow-[0_0_32px_rgba(34,211,238,0.28)] transition-[transform,width,height] duration-75 ease-out"
            >
              {/* Floating Window Identity Pill (docks inside when near top picker edge/toolbar) */}
              <div
                className={`absolute inline-flex max-w-[460px] items-center gap-1.5 rounded-full border border-cyan-300/40 bg-slate-950/90 px-3 py-1 text-xs font-medium text-slate-100 shadow-xl backdrop-blur-md ${
                  hoveredCssRect.y < 110 ? 'left-3 top-3' : '-top-9 left-0'
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
                <span className="ml-1 rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200 whitespace-nowrap shrink-0">
                  {t.pickerClickToBind}
                </span>
              </div>
            </div>
          )}

          {/* Custom Drag-Region Crop Box */}
          {dragRect && dragOsRect && (
            <div
              style={{
                transform: `translate3d(${dragRect.x}px, ${dragRect.y}px, 0)`,
                width: dragRect.width,
                height: dragRect.height,
              }}
              className="pointer-events-none fixed left-0 top-0 z-30 rounded-lg border-2 border-emerald-400 bg-emerald-400/12 shadow-[0_0_28px_rgba(16,185,129,0.3)]"
            >
              <div
                className={`absolute inline-flex items-center gap-1.5 rounded-full border border-emerald-300/45 bg-slate-950/92 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-200 shadow-lg whitespace-nowrap ${
                  dragRect.y < 80 ? 'left-2 top-2' : '-top-8 left-0'
                }`}
              >
                <span>{t.pickerDragRegionLabel}</span>
                <span>·</span>
                <span>
                  {dragOsRect.width} × {dragOsRect.height}
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
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loadingCdp ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
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
