import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow,
  Check,
  ChevronDown,
  Crop,
  Crosshair,
  Globe,
  Maximize2,
  Minimize2,
  Monitor,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { api } from '../api/client'
import type { ActionMarker, SessionDetail, SessionTargetInfo, TargetInfo } from '../api/types'
import { useLanguage } from '../i18n/LanguageContext'
import { formatTargetTitle } from '../i18n/translations'

interface ViewportMonitorProps {
  session: SessionDetail | null
  markers: ActionMarker[]
  refreshTrigger: number
  onManualRefresh: () => void
  onOpenNewSessionModal?: () => void
  onSwitchTarget?: (targetId: string) => Promise<void>
}

function getTargetIcon(targetId: string, targetType?: string) {
  const id = targetId.toLowerCase()
  if (targetType === 'region' || id.startsWith('region:')) {
    return <Crop className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
  }
  if (targetType === 'cdp' || id.startsWith('cdp:')) {
    return <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
  }
  if (targetType === 'display' || id.startsWith('display:')) {
    return <Monitor className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
  }
  return <AppWindow className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
}

export const ViewportMonitor: React.FC<ViewportMonitorProps> = ({
  session,
  markers,
  refreshTrigger,
  onManualRefresh,
  onOpenNewSessionModal,
  onSwitchTarget,
}) => {
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Target switcher dropdown state
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [availableTargets, setAvailableTargets] = useState<TargetInfo[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [switchingTargetId, setSwitchingTargetId] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const switcherRef = useRef<HTMLDivElement | null>(null)

  // Derive imgUrl cleanly without unnecessary state updates in effect
  const imgUrl = useMemo(() => {
    if (!session) return null
    return `${api.getScreenshotUrl(session.session_id)}&_rt=${refreshTrigger}`
  }, [session, refreshTrigger])

  // Close target switcher on session change
  useEffect(() => {
    setSwitcherOpen(false)
    setSwitchError(null)
  }, [session?.session_id])

  // Close target switcher on outside click or Escape
  useEffect(() => {
    if (!switcherOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [switcherOpen])

  const refreshAvailableTargets = useCallback(async () => {
    setLoadingTargets(true)
    setSwitchError(null)
    try {
      const list = await api.listTargets()
      setAvailableTargets(list)
    } catch {
      setAvailableTargets([])
    } finally {
      setLoadingTargets(false)
    }
  }, [])

  const handleToggleSwitcher = () => {
    if (!session || !onSwitchTarget) return
    setSwitcherOpen((prev) => {
      const next = !prev
      if (next) {
        void refreshAvailableTargets()
      }
      return next
    })
  }

  const handleSelectTarget = async (targetId: string) => {
    if (!onSwitchTarget || !session) return
    if (targetId === session.target.target_id) {
      setSwitcherOpen(false)
      return
    }
    setSwitchingTargetId(targetId)
    setSwitchError(null)
    try {
      await onSwitchTarget(targetId)
      setSwitcherOpen(false)
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : ''
      const isGeneric =
        !rawMsg || /^(Failed to fetch|NetworkError|HTTP \d+|Load failed)/i.test(rawMsg)
      setSwitchError(isGeneric ? t('viewport.switchTargetError') : rawMsg)
    } finally {
      setSwitchingTargetId(null)
    }
  }

  // Periodic polling if auto-refresh is enabled
  useEffect(() => {
    if (!autoRefresh || !session) return
    const interval = window.setInterval(() => {
      onManualRefresh()
    }, 2000)
    return () => window.clearInterval(interval)
  }, [autoRefresh, session, onManualRefresh])

  // Sync fullscreen state when user exits fullscreen via Escape key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current || !session) return
    const rect = imgRef.current.getBoundingClientRect()
    const scaleX = session.target.rect.width / rect.width
    const scaleY = session.target.rect.height / rect.height

    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top

    const x = Math.max(0, Math.min(Math.round(clientX * scaleX), session.target.rect.width))
    const y = Math.max(0, Math.min(Math.round(clientY * scaleY), session.target.rect.height))

    setHoverCoords({ x, y })
  }

  const handleMouseLeave = () => {
    setHoverCoords(null)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(console.error)
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(console.error)
    }
  }

  const targetWidth = session?.target.rect.width || 1920
  const targetHeight = session?.target.rect.height || 1080
  const sessionTargets = session?.targets
  const boundPool: SessionTargetInfo[] = useMemo(
    () => (sessionTargets && sessionTargets.length > 1 ? sessionTargets : []),
    [sessionTargets]
  )
  const boundPoolIds = useMemo(() => new Set(boundPool.map((item) => item.target_id)), [boundPool])
  const extraAvailableTargets = useMemo(
    () => availableTargets.filter((item) => !boundPoolIds.has(item.target_id)),
    [availableTargets, boundPoolIds]
  )

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-full'
      }`}
    >
      {/* Viewport Top Bar */}
      <div className="h-9 lg:h-11 px-3 lg:px-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2 select-none relative z-30">
        <div className="flex items-center gap-2 min-w-0">
          {session && onSwitchTarget ? (
            <div ref={switcherRef} className="relative min-w-0 flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSwitcher}
                aria-haspopup="listbox"
                aria-expanded={switcherOpen}
                title={t('viewport.switchTarget')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer min-w-0 max-w-[260px] lg:max-w-[340px] ${
                  switcherOpen
                    ? 'bg-slate-900 border-indigo-500/70 text-white'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white'
                }`}
              >
                {switchingTargetId ? (
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" aria-hidden="true" />
                ) : (
                  getTargetIcon(session.target.target_id, session.target.target_type)
                )}
                <span className="truncate">
                  {switchingTargetId
                    ? t('viewport.switchingTarget')
                    : formatTargetTitle(session.target.title, language)}
                </span>
                {boundPool.length > 1 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 whitespace-nowrap shrink-0">
                    {t('viewport.targetCount').replace('{count}', String(boundPool.length))}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                    switcherOpen ? 'rotate-180 text-indigo-400' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded font-mono whitespace-nowrap shrink-0">
                {targetWidth} × {targetHeight}
              </span>

              {/* Target Switcher Dropdown Popover */}
              {switcherOpen && (
                <div
                  role="listbox"
                  aria-label={t('viewport.switchTarget')}
                  className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 z-50 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                    <span className="text-[11px] font-semibold text-slate-300">
                      {t('viewport.switchTarget')}
                    </span>
                    <button
                      type="button"
                      onClick={() => void refreshAvailableTargets()}
                      disabled={loadingTargets}
                      aria-label={t('viewport.refreshTargets')}
                      title={t('viewport.refreshTargets')}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${loadingTargets ? 'animate-spin text-indigo-400' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {switchError && (
                    <div
                      role="alert"
                      className="mx-2.5 mt-2 p-2 rounded-lg text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-300"
                    >
                      {switchError}
                    </div>
                  )}

                  <div className="max-h-72 overflow-y-auto p-1.5 space-y-2">
                    {/* Bound Multi-Target Pool (if present) */}
                    {boundPool.length > 1 && (
                      <div className="space-y-1">
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                          {t('viewport.boundPool')}
                        </div>
                        {boundPool.map((item) => {
                          const isActive = item.target_id === session.target.target_id
                          return (
                            <button
                              key={item.target_id}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              disabled={Boolean(switchingTargetId)}
                              onClick={() => void handleSelectTarget(item.target_id)}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-600/20 text-white border border-indigo-500/40'
                                  : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {getTargetIcon(item.target_id, item.target_type)}
                                <div className="min-w-0">
                                  <div className="truncate font-medium">
                                    {formatTargetTitle(item.title, language)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {item.rect.width}×{item.rect.height}
                                  </div>
                                </div>
                              </div>
                              {isActive && (
                                <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* All Available OS Targets */}
                    <div className="space-y-1">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('viewport.availableTargets')}
                      </div>
                      {loadingTargets && extraAvailableTargets.length === 0 ? (
                        <div className="py-4 text-center text-[11px] text-slate-500">
                          {t('newSession.discovering')}
                        </div>
                      ) : extraAvailableTargets.length === 0 && boundPool.length === 0 ? (
                        <div className="py-4 text-center text-[11px] text-slate-500">
                          {t('viewport.noTargetsAvailable')}
                        </div>
                      ) : (
                        extraAvailableTargets.map((item) => {
                          const isActive = item.target_id === session.target.target_id
                          return (
                            <button
                              key={item.target_id}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              disabled={Boolean(switchingTargetId)}
                              onClick={() => void handleSelectTarget(item.target_id)}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-600/20 text-white border border-indigo-500/40'
                                  : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {getTargetIcon(item.target_id, item.target_type)}
                                <div className="min-w-0">
                                  <div className="truncate font-medium">
                                    {formatTargetTitle(item.title, language) ||
                                      t('newSession.untitledTarget')}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate">
                                    {item.rect.width}×{item.rect.height} • {item.target_id.slice(0, 14)}
                                  </div>
                                </div>
                              </div>
                              {isActive && (
                                <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                              )}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-hidden">
              <Monitor className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold text-slate-200 truncate">
                {session ? formatTargetTitle(session.target.title, language) : t('viewport.noTarget')}
              </span>
              {session && (
                <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded font-mono whitespace-nowrap shrink-0">
                  {targetWidth} × {targetHeight}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 lg:gap-3 shrink-0">
          {/* Coordinates HUD */}
          {hoverCoords && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded shadow-sm whitespace-nowrap shrink-0">
              <Crosshair className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>
                X: {hoverCoords.x}, Y: {hoverCoords.y}
              </span>
            </div>
          )}

          {/* Auto Refresh Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 accent-indigo-500 w-3 h-3 shrink-0"
            />
            <span className="text-[11px]">{t('viewport.autoRefresh')}</span>
          </label>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              onManualRefresh()
            }}
            aria-label={t('viewport.manualRefresh')}
            title={t('viewport.manualRefresh')}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? t('viewport.exitFullscreen') : t('viewport.fullscreen')}
            title={isFullscreen ? t('viewport.exitFullscreen') : t('viewport.fullscreen')}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Screen Frame Content Area */}
      <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden p-2">
        {!session ? (
          <div className="text-center p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto border border-slate-700/50">
              <Monitor className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">{t('viewport.noTarget')}</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                {t('viewport.noTargetDesc')}
              </p>
            </div>
            {onOpenNewSessionModal && (
              <button
                type="button"
                onClick={onOpenNewSessionModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('viewport.selectTarget')}</span>
              </button>
            )}
          </div>
        ) : imgUrl ? (
          <div className="relative max-w-full max-h-full flex items-center justify-center select-none group">
            <img
              ref={imgRef}
              src={imgUrl}
              alt={t('viewport.title')}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="max-h-[calc(100vh-14rem)] max-w-full object-contain rounded-lg border border-slate-800 shadow-2xl pointer-events-auto cursor-crosshair transition-opacity duration-150"
            />

            {/* Ripple Markers for Agent Actions */}
            {markers.map((marker) => {
              const xPercent = (marker.x / targetWidth) * 100
              const yPercent = (marker.y / targetHeight) * 100
              return (
                <div
                  key={marker.id}
                  style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
                >
                  {/* Radar pulse ring */}
                  <span className="absolute -inset-3 rounded-full bg-rose-500/40 animate-ping" />
                  <span className="absolute -inset-1 rounded-full bg-rose-500/80" />
                  <span className="relative block w-3 h-3 rounded-full bg-rose-400 border border-white shadow-[0_0_10px_rgba(244,63,94,1)]" />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-950/90 text-rose-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-rose-500/30 whitespace-nowrap">
                    {marker.action} ({marker.x}, {marker.y})
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-xs text-slate-500">{t('viewport.loading')}</div>
        )}
      </div>
    </div>
  )
}
