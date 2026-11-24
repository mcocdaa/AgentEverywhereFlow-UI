import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  AppWindow,
  Check,
  Code2,
  Copy,
  Crop,
  Globe,
  Layers,
  Monitor,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import type {
  CdpTargetInfo,
  CreateSessionRequest,
  ExecutionMode,
  PermissionMode,
  TargetInfo,
} from '../api/types'
import { useLanguage } from '../i18n/LanguageContext'
import { formatTargetTitle, type TranslationKey } from '../i18n/translations'
import { ModalDialog } from './ModalDialog'

interface NewSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSessionCreated: (sessionId: string) => void
}

type PickerTab = 'screens_windows' | 'region' | 'cdp'

const REGION_PRESETS = [
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1440 × 900', width: 1440, height: 900 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '800 × 600', width: 800, height: 600 },
] as const

const CDP_LAUNCH_CMD = 'chrome --remote-debugging-port=9222'

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated,
}) => {
  const { t, language } = useLanguage()
  const baseId = useId()
  const titleId = `${baseId}-title`
  const tabIds: Record<PickerTab, string> = {
    screens_windows: `${baseId}-tab-screens`,
    region: `${baseId}-tab-region`,
    cdp: `${baseId}-tab-cdp`,
  }
  const tabRefs = useRef<Partial<Record<PickerTab, HTMLButtonElement | null>>>({})

  const [activeTab, setActiveTab] = useState<PickerTab>('screens_windows')

  // Screens & Windows state
  const [targets, setTargets] = useState<TargetInfo[]>([])
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])
  const [filterType, setFilterType] = useState<'all' | 'window' | 'display'>('all')
  const [thumbnailNonce, setThumbnailNonce] = useState<number>(() => Date.now())
  const [failedThumbs, setFailedThumbs] = useState<Record<string, boolean>>({})
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [refreshedNotice, setRefreshedNotice] = useState(false)

  // Custom Region state
  const [regionX, setRegionX] = useState('100')
  const [regionY, setRegionY] = useState('100')
  const [regionWidth, setRegionWidth] = useState('1280')
  const [regionHeight, setRegionHeight] = useState('720')
  const [regionTitle, setRegionTitle] = useState('')

  // CDP Headless Browser state
  const [cdpEndpoint, setCdpEndpoint] = useState('http://127.0.0.1:9222')
  const [cdpTargets, setCdpTargets] = useState<CdpTargetInfo[]>([])
  const [selectedCdpId, setSelectedCdpId] = useState<string>('')
  const [loadingCdp, setLoadingCdp] = useState(false)
  const [cdpLoadedOnce, setCdpLoadedOnce] = useState(false)
  const [copiedCdpCmd, setCopiedCdpCmd] = useState(false)

  // Session options
  const [mode, setMode] = useState<ExecutionMode>('minimal')
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('auto')
  const [submitting, setSubmitting] = useState(false)
  const [errorState, setErrorState] = useState<{ key?: TranslationKey; raw?: string } | null>(null)

  const resolvedError = errorState
    ? errorState.key
      ? t(errorState.key)
      : errorState.raw || null
    : null

  const fetchTargets = useCallback(async () => {
    setLoadingTargets(true)
    setErrorState(null)
    const startTime = Date.now()
    try {
      const data = await api.listTargets()
      setTargets(data)
      setFailedThumbs({})
      setThumbnailNonce(Date.now())

      const elapsed = Date.now() - startTime
      if (elapsed < 300) {
        await new Promise((r) => setTimeout(r, 300 - elapsed))
      }

      setSelectedTargetIds((curr) => {
        if (data.length === 0) return []
        const valid = curr.filter((id) => data.some((item) => item.target_id === id))
        if (valid.length > 0) return valid

        const userApp = data.find(
          (item) =>
            item.target_type === 'window' && !item.title.includes('AgentEverywhereFlow Studio')
        )
        if (userApp) return [userApp.target_id]

        const display = data.find((item) => item.target_type === 'display')
        if (display) return [display.target_id]

        return [data[0].target_id]
      })

      setRefreshedNotice(true)
      window.setTimeout(() => setRefreshedNotice(false), 1800)
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : ''
      const isGenericErr =
        !rawMsg || /^(Failed to fetch|NetworkError|HTTP \d+|Load failed)/i.test(rawMsg)
      setErrorState(
        isGenericErr ? { key: 'newSession.fetchTargetsError' } : { raw: rawMsg }
      )
    } finally {
      setLoadingTargets(false)
    }
  }, [])

  const fetchCdpTargets = useCallback(async (endpointOverride?: string) => {
    setLoadingCdp(true)
    setErrorState(null)
    try {
      const res = await api.listCdpTargets(endpointOverride ?? cdpEndpoint)
      setCdpTargets(res.targets)
      setCdpLoadedOnce(true)
      setSelectedCdpId((curr) => {
        if (res.targets.length === 0) return ''
        if (res.targets.some((item) => item.target_id === curr)) return curr
        return res.targets[0].target_id
      })
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : ''
      const isGenericErr =
        !rawMsg || /^(Failed to fetch|NetworkError|HTTP \d+|Load failed)/i.test(rawMsg)
      setCdpTargets([])
      setCdpLoadedOnce(true)
      setErrorState(isGenericErr ? { key: 'newSession.cdpFetchError' } : { raw: rawMsg })
    } finally {
      setLoadingCdp(false)
    }
  }, [cdpEndpoint])

  useEffect(() => {
    if (isOpen) {
      setErrorState(null)
      void fetchTargets()
    }
  }, [isOpen, fetchTargets])

  useEffect(() => {
    if (isOpen && activeTab === 'cdp' && !cdpLoadedOnce) {
      void fetchCdpTargets()
    }
  }, [isOpen, activeTab, cdpLoadedOnce, fetchCdpTargets])

  const filteredTargets = targets.filter((item) => {
    if (filterType === 'all') return true
    return item.target_type === filterType
  })

  const handleCardSelect = (targetId: string, multiToggle: boolean) => {
    setErrorState(null)
    setSelectedTargetIds((prev) => {
      if (multiToggle || prev.length > 1) {
        if (prev.includes(targetId)) {
          return prev.filter((id) => id !== targetId)
        }
        return [...prev, targetId]
      }
      return [targetId]
    })
  }

  const handleCheckboxToggle = (targetId: string) => {
    setErrorState(null)
    setSelectedTargetIds((prev) =>
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]
    )
  }

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const order: PickerTab[] = ['screens_windows', 'region', 'cdp']
    const idx = order.indexOf(activeTab)
    let nextIdx = -1
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % order.length
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + order.length) % order.length
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = order.length - 1

    if (nextIdx >= 0) {
      e.preventDefault()
      const nextTab = order[nextIdx]
      setActiveTab(nextTab)
      setErrorState(null)
      tabRefs.current[nextTab]?.focus()
    }
  }

  const handleCopyCdpCmd = () => {
    navigator.clipboard
      .writeText(CDP_LAUNCH_CMD)
      .then(() => {
        setCopiedCdpCmd(true)
        window.setTimeout(() => setCopiedCdpCmd(false), 1800)
      })
      .catch(() => {
        // ignore clipboard failure
      })
  }

  const parsedRegion = {
    x: Number.parseInt(regionX, 10) || 0,
    y: Number.parseInt(regionY, 10) || 0,
    width: Number.parseInt(regionWidth, 10) || 0,
    height: Number.parseInt(regionHeight, 10) || 0,
  }
  const isRegionValid = parsedRegion.width >= 64 && parsedRegion.height >= 64

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorState(null)

    let payload: CreateSessionRequest

    if (activeTab === 'screens_windows') {
      if (selectedTargetIds.length === 0) {
        setErrorState({ key: 'newSession.selectTargetError' })
        return
      }
      payload = {
        target_id: selectedTargetIds[0],
        ...(selectedTargetIds.length > 1 ? { target_ids: selectedTargetIds } : {}),
        mode,
        permission_mode: permissionMode,
      }
    } else if (activeTab === 'region') {
      if (!isRegionValid) {
        setErrorState({ key: 'newSession.regionInvalidError' })
        return
      }
      const trimmedTitle = regionTitle.trim()
      payload = {
        target_id: `region:${parsedRegion.x},${parsedRegion.y},${parsedRegion.width},${parsedRegion.height}`,
        region: {
          x: parsedRegion.x,
          y: parsedRegion.y,
          width: parsedRegion.width,
          height: parsedRegion.height,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
        },
        mode,
        permission_mode: permissionMode,
      }
    } else {
      const selectedCdp = cdpTargets.find((item) => item.target_id === selectedCdpId)
      if (!selectedCdp) {
        setErrorState({ key: 'newSession.cdpSelectError' })
        return
      }
      payload = {
        target_id: selectedCdp.target_id,
        cdp_ws_url: selectedCdp.ws_url,
        mode,
        permission_mode: permissionMode,
      }
    }

    setSubmitting(true)
    try {
      const session = await api.createSession(payload)
      onSessionCreated(session.session_id)
      onClose()
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : ''
      const isGenericErr =
        !rawMsg || /^(Failed to fetch|NetworkError|HTTP \d+|Load failed)/i.test(rawMsg)
      setErrorState(
        isGenericErr ? { key: 'newSession.createSessionError' } : { raw: rawMsg }
      )
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: Array<{ id: PickerTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'screens_windows',
      label: t('newSession.tabScreensWindows'),
      icon: <Monitor className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'region',
      label: t('newSession.tabRegion'),
      icon: <Crop className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'cdp',
      label: t('newSession.tabCdp'),
      icon: <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
    },
  ]

  const launchLabel =
    activeTab === 'screens_windows' && selectedTargetIds.length > 1
      ? t('newSession.launchMultiSession').replace('{count}', String(selectedTargetIds.length))
      : t('newSession.launchSession')

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      className="w-full max-w-3xl"
    >
      <form
        onSubmit={handleCreate}
        noValidate
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 lg:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-950/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 id={titleId} className="text-sm lg:text-base font-semibold text-white truncate">
                {t('newSession.title')}
              </h1>
              <p className="text-xs text-slate-400 truncate">{t('newSession.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('newSession.close')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-5 overflow-y-auto flex-1 min-h-0">
          {resolvedError && (
            <div
              role="alert"
              className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl"
            >
              {resolvedError}
            </div>
          )}

          {/* 1. Visual Target Picker Section */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {t('newSession.selectTarget')}
              </span>
              {activeTab === 'screens_windows' && selectedTargetIds.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {t('newSession.multiSelectedBadge').replace(
                      '{count}',
                      String(selectedTargetIds.length)
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTargetIds((prev) => prev.slice(0, 1))}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2 cursor-pointer whitespace-nowrap"
                  >
                    {t('newSession.clearSelection')}
                  </button>
                </div>
              )}
            </div>

            {/* Primary 3-Tab Switcher */}
            <div
              role="tablist"
              aria-label={t('newSession.targetSourceTabs')}
              onKeyDown={handleTabKeyDown}
              className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto"
              {...({ focusgroup: 'tablist nomemory' } as Record<string, string>)}
            >
              {tabs.map((tab) => {
                const isSelected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el
                    }}
                    type="button"
                    role="tab"
                    id={tabIds[tab.id]}
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setErrorState(null)
                    }}
                    className={`aef-tab flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                      isSelected
                        ? 'text-indigo-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    {...(isSelected ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Tab Panel 1: Screens & Windows (Zoom-Style Visual Thumbnail Grid) */}
            <div
              role="tabpanel"
              aria-labelledby={tabIds.screens_windows}
              hidden={activeTab !== 'screens_windows'}
            >
              {activeTab === 'screens_windows' && (
                <div className="space-y-2.5 pt-1">
                  {/* Sub-filters & Refresh */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => setFilterType('all')}
                        className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 transition cursor-pointer ${
                          filterType === 'all'
                            ? 'bg-slate-800 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('newSession.all')} ({targets.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterType('window')}
                        className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 transition cursor-pointer ${
                          filterType === 'window'
                            ? 'bg-slate-800 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('newSession.windows')} (
                        {targets.filter((item) => item.target_type === 'window').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterType('display')}
                        className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 transition cursor-pointer ${
                          filterType === 'display'
                            ? 'bg-slate-800 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t('newSession.displays')} (
                        {targets.filter((item) => item.target_type === 'display').length})
                      </button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {refreshedNotice && (
                        <span
                          role="status"
                          className="text-[11px] text-emerald-400 font-medium whitespace-nowrap"
                        >
                          {t('newSession.updated')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void fetchTargets()}
                        disabled={loadingTargets}
                        aria-label={t('newSession.refreshTargets')}
                        title={t('newSession.refreshTargets')}
                        className="p-1.5 rounded-lg bg-slate-800/90 text-slate-300 hover:text-white border border-slate-700/70 transition disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            loadingTargets ? 'animate-spin text-indigo-400' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail Grid */}
                  {filteredTargets.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800/80">
                      {loadingTargets ? t('newSession.discovering') : t('newSession.noTargets')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {filteredTargets.map((target) => {
                        const isSelected = selectedTargetIds.includes(target.target_id)
                        const thumbFailed = Boolean(failedThumbs[target.target_id])
                        const localizedTitle =
                          formatTargetTitle(target.title, language) ||
                          t('newSession.untitledTarget')
                        const thumbUrl = api.getTargetThumbnailUrl(
                          target.target_id,
                          360,
                          thumbnailNonce
                        )
                        const processLabel =
                          target.process_name &&
                          target.process_name.toLowerCase() !== 'display' &&
                          target.process_name.toLowerCase() !== 'window'
                            ? target.process_name
                            : target.target_type === 'display'
                            ? t('newSession.targetTypeDisplay')
                            : t('newSession.targetTypeWindow')

                        return (
                          <div
                            key={target.target_id}
                            className={`group relative rounded-xl border overflow-hidden transition flex flex-col ${
                              isSelected
                                ? 'bg-indigo-600/12 border-indigo-500/80 ring-1 ring-indigo-500/40 shadow-md shadow-indigo-500/10'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                            }`}
                          >
                            {/* Multi-Target Checkbox (top-right corner) */}
                            <label
                              className="absolute top-2 right-2 z-20 flex items-center justify-center w-6 h-6 rounded-md bg-slate-950/80 border border-slate-700/80 backdrop-blur-sm cursor-pointer hover:border-indigo-400 transition"
                              title={t('newSession.toggleTargetCheck')}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleCheckboxToggle(target.target_id)}
                                aria-label={`${t('newSession.toggleTargetCheck')}: ${localizedTitle}`}
                                className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer"
                              />
                            </label>

                            {/* Card Clickable Body */}
                            <button
                              type="button"
                              onClick={(e) =>
                                handleCardSelect(target.target_id, e.metaKey || e.ctrlKey)
                              }
                              aria-pressed={isSelected}
                              className="text-left w-full flex flex-col flex-1 cursor-pointer"
                            >
                              {/* 16:10 Live Thumbnail Preview Stage */}
                              <div className="relative aspect-[16/10] w-full bg-slate-950 border-b border-slate-800/80 flex items-center justify-center overflow-hidden">
                                {!thumbFailed ? (
                                  <img
                                    src={thumbUrl}
                                    alt=""
                                    loading="lazy"
                                    onError={() =>
                                      setFailedThumbs((prev) => ({
                                        ...prev,
                                        [target.target_id]: true,
                                      }))
                                    }
                                    className="w-full h-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.02]"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-500 px-3">
                                    <div
                                      className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                                        isSelected
                                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                          : 'bg-slate-900 border-slate-800 text-slate-400'
                                      }`}
                                    >
                                      {target.target_type === 'display' ? (
                                        <Monitor className="w-4 h-4" aria-hidden="true" />
                                      ) : (
                                        <AppWindow className="w-4 h-4" aria-hidden="true" />
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500">
                                      {target.rect.width} × {target.rect.height}
                                    </span>
                                  </div>
                                )}

                                {/* Type Badge (top-left) */}
                                <div className="absolute top-2 left-2 flex items-center gap-1 pointer-events-none">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-950/80 text-slate-200 border border-slate-700/80 backdrop-blur-sm whitespace-nowrap">
                                    {target.target_type === 'display' ? (
                                      <Monitor className="w-2.5 h-2.5 text-indigo-400" aria-hidden="true" />
                                    ) : (
                                      <AppWindow className="w-2.5 h-2.5 text-indigo-400" aria-hidden="true" />
                                    )}
                                    <span>
                                      {target.target_type === 'display'
                                        ? t('newSession.targetTypeDisplay')
                                        : t('newSession.targetTypeWindow')}
                                    </span>
                                  </span>
                                  {target.is_minimized && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-500/40 whitespace-nowrap">
                                      {t('newSession.minimized')}
                                    </span>
                                  )}
                                </div>

                                {/* Resolution Overlay (bottom-right) */}
                                {!thumbFailed && (
                                  <span className="absolute bottom-1.5 right-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950/80 text-slate-300 border border-slate-800/80 backdrop-blur-sm pointer-events-none">
                                    {target.rect.width}×{target.rect.height}
                                  </span>
                                )}
                              </div>

                              {/* Metadata Footer */}
                              <div className="p-2.5 space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs font-semibold text-slate-100 truncate">
                                    {localizedTitle}
                                  </span>
                                  {target.title.includes('AgentEverywhereFlow Studio') && (
                                    <span className="text-[9px] text-cyan-300 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/30 shrink-0 whitespace-nowrap">
                                      {t('newSession.studioBadge')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  {processLabel} • {target.target_id.slice(0, 14)}
                                </div>
                              </div>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tab Panel 2: Custom Region */}
            <div
              role="tabpanel"
              aria-labelledby={tabIds.region}
              hidden={activeTab !== 'region'}
            >
              {activeTab === 'region' && (
                <div className="space-y-3.5 pt-1 bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      {t('newSession.regionPresets')}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {REGION_PRESETS.map((preset) => {
                        const isMatch =
                          parsedRegion.width === preset.width &&
                          parsedRegion.height === preset.height
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setRegionWidth(String(preset.width))
                              setRegionHeight(String(preset.height))
                              setErrorState(null)
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition cursor-pointer whitespace-nowrap ${
                              isMatch
                                ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Coordinate & Size Inputs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="space-y-1">
                      <label
                        htmlFor={`${baseId}-reg-x`}
                        className="block text-[11px] font-medium text-slate-400"
                      >
                        {t('newSession.regionX')}
                      </label>
                      <input
                        id={`${baseId}-reg-x`}
                        name="region_x"
                        type="number"
                        inputMode="numeric"
                        value={regionX}
                        onChange={(e) => setRegionX(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-indigo-500 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`${baseId}-reg-y`}
                        className="block text-[11px] font-medium text-slate-400"
                      >
                        {t('newSession.regionY')}
                      </label>
                      <input
                        id={`${baseId}-reg-y`}
                        name="region_y"
                        type="number"
                        inputMode="numeric"
                        value={regionY}
                        onChange={(e) => setRegionY(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-indigo-500 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`${baseId}-reg-w`}
                        className="block text-[11px] font-medium text-slate-400"
                      >
                        {t('newSession.regionWidth')}
                      </label>
                      <input
                        id={`${baseId}-reg-w`}
                        name="region_width"
                        type="number"
                        inputMode="numeric"
                        min={64}
                        value={regionWidth}
                        aria-invalid={parsedRegion.width < 64 ? true : undefined}
                        onChange={(e) => {
                          setRegionWidth(e.target.value)
                          setErrorState(null)
                        }}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-indigo-500 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`${baseId}-reg-h`}
                        className="block text-[11px] font-medium text-slate-400"
                      >
                        {t('newSession.regionHeight')}
                      </label>
                      <input
                        id={`${baseId}-reg-h`}
                        name="region_height"
                        type="number"
                        inputMode="numeric"
                        min={64}
                        value={regionHeight}
                        aria-invalid={parsedRegion.height < 64 ? true : undefined}
                        onChange={(e) => {
                          setRegionHeight(e.target.value)
                          setErrorState(null)
                        }}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  {/* Optional Region Title & Live Rect Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div className="space-y-1">
                      <label
                        htmlFor={`${baseId}-reg-title`}
                        className="block text-[11px] font-medium text-slate-400"
                      >
                        {t('newSession.regionTitle')}
                      </label>
                      <input
                        id={`${baseId}-reg-title`}
                        name="region_title"
                        type="text"
                        value={regionTitle}
                        onChange={(e) => setRegionTitle(e.target.value)}
                        placeholder={t('newSession.regionTitlePlaceholder')}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]">
                      <span className="text-slate-400 whitespace-nowrap">
                        {t('newSession.regionSummary')}
                      </span>
                      <span className="font-mono text-indigo-300 whitespace-nowrap">
                        ({parsedRegion.x}, {parsedRegion.y}) · {parsedRegion.width}×
                        {parsedRegion.height}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tab Panel 3: Headless Browser (CDP) */}
            <div
              role="tabpanel"
              aria-labelledby={tabIds.cdp}
              hidden={activeTab !== 'cdp'}
            >
              {activeTab === 'cdp' && (
                <div className="space-y-3 pt-1">
                  {/* Endpoint + Scan Row */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label
                        htmlFor={`${baseId}-cdp-endpoint`}
                        className="block text-[11px] font-medium text-slate-400"
                      >
                        {t('newSession.cdpEndpointLabel')}
                      </label>
                      <input
                        id={`${baseId}-cdp-endpoint`}
                        name="cdp_endpoint"
                        type="url"
                        value={cdpEndpoint}
                        onChange={(e) => setCdpEndpoint(e.target.value)}
                        placeholder={t('newSession.cdpEndpointPlaceholder')}
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:border-indigo-500 transition"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void fetchCdpTargets(cdpEndpoint)}
                      disabled={loadingCdp}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${loadingCdp ? 'animate-spin text-indigo-400' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{t('newSession.cdpScan')}</span>
                    </button>
                  </div>

                  {/* Discovered CDP Tabs */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {loadingCdp ? (
                      <div className="text-center py-6 text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800/80">
                        {t('newSession.cdpScanning')}
                      </div>
                    ) : cdpTargets.length === 0 ? (
                      <div className="text-center py-6 px-4 text-xs text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800/80">
                        {t('newSession.cdpNoTabs')}
                      </div>
                    ) : (
                      cdpTargets.map((tab) => {
                        const isSelected = selectedCdpId === tab.target_id
                        return (
                          <button
                            key={tab.target_id}
                            type="button"
                            onClick={() => {
                              setSelectedCdpId(tab.target_id)
                              setErrorState(null)
                            }}
                            aria-pressed={isSelected}
                            className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600/15 border-indigo-500/70 shadow-sm'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                  isSelected
                                    ? 'bg-indigo-600/25 border-indigo-500/40 text-indigo-300'
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                                }`}
                              >
                                <Globe className="w-4 h-4" aria-hidden="true" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-100 truncate">
                                  {tab.title || tab.url || tab.target_id}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono truncate">
                                  {tab.url}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check
                                className="w-4 h-4 text-indigo-400 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>

                  {/* Concise Zero-Interference Launch Tip */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-200">
                      {t('newSession.cdpTipTitle')}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {t('newSession.cdpTipDesc')}
                    </p>
                    <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                      <code className="text-[11px] font-mono text-indigo-300 truncate">
                        {CDP_LAUNCH_CMD}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyCdpCmd}
                        aria-label={t('newSession.cdpCopyCmd')}
                        className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {copiedCdpCmd ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                            <span>{t('newSession.cdpCopied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" aria-hidden="true" />
                            <span>{t('newSession.cdpCopyCmd')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 2. Execution Mode Selection */}
          <fieldset className="space-y-1.5 lg:space-y-2 border-0 p-0 m-0">
            <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {t('newSession.executionMode')}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={mode === 'minimal'}
                onClick={() => setMode('minimal')}
                className={`text-left p-3 rounded-xl border cursor-pointer transition ${
                  mode === 'minimal'
                    ? 'bg-indigo-600/15 border-indigo-500/60 shadow-sm'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Code2 className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-white">
                    {t('newSession.modeMinimal')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t('newSession.modeMinimalDesc')}
                </p>
              </button>

              <button
                type="button"
                aria-pressed={mode === 'guarded'}
                onClick={() => setMode('guarded')}
                className={`text-left p-3 rounded-xl border cursor-pointer transition ${
                  mode === 'guarded'
                    ? 'bg-indigo-600/15 border-indigo-500/60 shadow-sm'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-white">
                    {t('newSession.modeGuarded')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t('newSession.modeGuardedDesc')}
                </p>
              </button>
            </div>
          </fieldset>

          {/* 3. Permission Gate Mode */}
          <fieldset className="space-y-1.5 lg:space-y-2 border-0 p-0 m-0">
            <legend className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {t('newSession.permissionMode')}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={permissionMode === 'auto'}
                onClick={() => setPermissionMode('auto')}
                className={`text-left p-3 rounded-xl border cursor-pointer transition ${
                  permissionMode === 'auto'
                    ? 'bg-emerald-600/15 border-emerald-500/60 shadow-sm'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-white">
                    {t('newSession.permAuto')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t('newSession.permAutoDesc')}
                </p>
              </button>

              <button
                type="button"
                aria-pressed={permissionMode === 'manual'}
                onClick={() => setPermissionMode('manual')}
                className={`text-left p-3 rounded-xl border cursor-pointer transition ${
                  permissionMode === 'manual'
                    ? 'bg-amber-600/15 border-amber-500/60 shadow-sm'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-white">
                    {t('newSession.permManual')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t('newSession.permManualDesc')}
                </p>
              </button>
            </div>
          </fieldset>
        </div>

        {/* Modal Footer */}
        <div className="px-5 lg:px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 lg:py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
          >
            {t('newSession.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-1.5 lg:py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                <span>{t('newSession.bindingSession')}</span>
              </>
            ) : (
              <span>{launchLabel}</span>
            )}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}
