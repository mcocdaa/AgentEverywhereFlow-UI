import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Globe,
  Minimize2,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  Square,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { CopyCommandButton } from '../components/CopyCommandButton'
import { AEFlowMark, EnterReturnIcon, TargetTypeIcon } from '../components/Icons'
import { InlineConfigDrawer } from '../components/InlineConfigDrawer'
import type { Locale, Translations } from '../i18n/translations'
import { DEMO_TARGETS, desktopApi } from '../lib/api'
import {
  bootstrapViaUv,
  collapseToPill,
  discoverOrStartDaemon,
  hideCommand,
  hideTargetBorder,
  isTauri,
  onPreviewAction,
  openStudioInBrowser,
  resizeCommandWindow,
  restartDaemon,
  showPicker,
  showTargetBorder,
  startWindowDrag,
  tauriListen,
} from '../lib/tauri'
import type {
  ConfigPatch,
  ConfigResponse,
  DaemonDiscoveryResult,
  ExecutionMode,
  PendingApproval,
  PermissionMode,
  PickerSelectionPayload,
  RegionSpec,
  SessionEvent,
  TargetInfo,
} from '../lib/types'
import { useToolbarRoving } from '../lib/useToolbarRoving'

interface ActionChipItem {
  id: string
  step: number
  summary: string
  detail: string
  status: 'proposed' | 'executed'
}

interface ConversationEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  reasoning?: string
  actions?: ActionChipItem[]
  status?: 'streaming' | 'running' | 'completed' | 'aborted' | 'error'
  error?: string
}

interface SlashCommandItem {
  cmd: string
  label: string
  desc: string
  meta?: string
}

interface CommandPopupProps {
  t: Translations
  locale: Locale
  onToggleLocale: () => void
  simulateMissingBackend?: boolean
  initialSelection?: PickerSelectionPayload | null
  onSelectionChange?: (selection: PickerSelectionPayload) => void
}

function summarizeAction(payload: Record<string, unknown>): { summary: string; detail: string } {
  const code = typeof payload.code === 'string' ? payload.code.trim() : ''
  const action = typeof payload.action === 'string' ? payload.action : ''
  const toolName = typeof payload.tool === 'string' ? payload.tool : action
  const params = payload.params && typeof payload.params === 'object' ? payload.params : null

  if (code) {
    const firstLine = code.split('\n').find((l) => l.trim().length > 0) || code
    return {
      summary: firstLine.length > 42 ? `${firstLine.slice(0, 42)}…` : firstLine,
      detail: code,
    }
  }
  if (toolName) {
    const serialized = params ? JSON.stringify(params) : ''
    return {
      summary: serialized ? `${toolName}(${serialized.slice(0, 30)})` : toolName,
      detail: serialized ? JSON.stringify({ action: toolName, params }, null, 2) : toolName,
    }
  }
  const fallback = JSON.stringify(payload)
  return {
    summary: fallback.slice(0, 38),
    detail: JSON.stringify(payload, null, 2),
  }
}

export function CommandPopup({
  t,
  locale,
  onToggleLocale,
  simulateMissingBackend = false,
  initialSelection = null,
  onSelectionChange,
}: CommandPopupProps) {
  const [daemon, setDaemon] = useState<DaemonDiscoveryResult | null>(null)
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapLog, setBootstrapLog] = useState<string | null>(null)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  const [selectedTargets, setSelectedTargets] = useState<TargetInfo[]>(
    initialSelection?.targets ?? [DEMO_TARGETS[1]],
  )
  const [selectedRegion, setSelectedRegion] = useState<RegionSpec | undefined>(
    initialSelection?.region,
  )
  const [selectedCdpWsUrl, setSelectedCdpWsUrl] = useState<string | undefined>(
    initialSelection?.cdpTarget?.ws_url,
  )

  const [mode, setMode] = useState<ExecutionMode>('minimal')
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('auto')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)

  const [input, setInput] = useState('')
  const [entries, setEntries] = useState<ConversationEntry[]>([])
  const [expandedChips, setExpandedChips] = useState<Record<string, boolean>>({})
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({})
  const [showConfigDrawer, setShowConfigDrawer] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)

  const cardRef = useRef<HTMLDivElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const streamEndRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const previewTimersRef = useRef<number[]>([])

  const inputId = useId()
  useToolbarRoving(toolbarRef)

  const primaryTarget = selectedTargets[0] ?? null

  // Discover or start local AEFlow daemon on mount
  const initDaemon = useCallback(async () => {
    try {
      const info = await discoverOrStartDaemon()
      setDaemon(info)
      desktopApi.setBaseUrl(info.url)

      if (info.mode !== 'missing_backend') {
        try {
          const cfg = await desktopApi.getConfig()
          setConfig(cfg)
          if (cfg.default_mode) setMode(cfg.default_mode)
          if (cfg.default_permission) setPermissionMode(cfg.default_permission)
          if (cfg.api_key_set === false) {
            setShowConfigDrawer(true)
          }
        } catch {
          // config endpoint may not exist on older daemons
        }
      }
    } catch {
      setDaemon({
        url: null,
        mode: 'missing_backend',
        install_hint: 'uv tool install agenteverywhereflow',
        has_uv: false,
      })
    }
  }, [])

  useEffect(() => {
    void initDaemon()
  }, [initDaemon])

  // Listen for target selection, daemon status, and bootstrap progress events
  useEffect(() => {
    const cleanups: Array<() => void> = []

    const applySelection = (sel: PickerSelectionPayload) => {
      if (sel.targets.length > 0) {
        setSelectedTargets(sel.targets)
        setSelectedRegion(sel.region)
        setSelectedCdpWsUrl(sel.cdpTarget?.ws_url)
        setSessionId(null)
        onSelectionChange?.(sel)
      }
      window.setTimeout(() => textareaRef.current?.focus(), 40)
    }

    if (isTauri()) {
      void tauriListen<string>('aeflow://target-selected', (jsonStr) => {
        try {
          const parsed = JSON.parse(jsonStr) as PickerSelectionPayload
          applySelection(parsed)
        } catch {
          // ignore malformed target payload
        }
      }).then((fn) => cleanups.push(fn))

      void tauriListen<DaemonDiscoveryResult>('aeflow://daemon-status', (status) => {
        setDaemon(status)
        desktopApi.setBaseUrl(status.url)
      }).then((fn) => cleanups.push(fn))

      void tauriListen<string>('aeflow://bootstrap-log', (line) => {
        setBootstrapLog(line)
      }).then((fn) => cleanups.push(fn))

      void tauriListen<void>('aeflow://command-summoned', () => {
        window.setTimeout(() => textareaRef.current?.focus(), 30)
      }).then((fn) => cleanups.push(fn))
    } else {
      cleanups.push(
        onPreviewAction((action) => {
          if (action.type === 'target-selected') {
            applySelection(action.payload)
          }
        }),
      )
    }

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [onSelectionChange])

  // Dynamically resize native Tauri command window smoothly when card height changes
  useEffect(() => {
    if (!isTauri() || !cardRef.current) return
    const el = cardRef.current
    const observer = new ResizeObserver((obsEntries) => {
      const entry = obsEntries[0]
      if (!entry) return
      const targetHeight = Math.min(520, Math.max(114, Math.ceil(entry.contentRect.height) + 8))
      void resizeCommandWindow(targetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll conversation stream to bottom as deltas arrive
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [entries, pendingApproval])

  // Cleanup WS & preview simulation timers on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      previewTimersRef.current.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const slashCommands: SlashCommandItem[] = useMemo(
    () => [
      { cmd: '/pick', label: '/pick', desc: t.slashPickDesc },
      {
        cmd: '/mode',
        label: '/mode',
        desc: t.slashModeDesc,
        meta: mode === 'minimal' ? t.modeMinimal : t.modeGuarded,
      },
      {
        cmd: '/perm',
        label: '/perm',
        desc: t.slashPermDesc,
        meta: permissionMode === 'auto' ? t.permAuto : t.permManual,
      },
      { cmd: '/studio', label: '/studio', desc: t.slashStudioDesc },
      { cmd: '/settings', label: '/settings', desc: t.slashSettingsDesc },
      { cmd: '/clear', label: '/clear', desc: t.slashClearDesc },
    ],
    [t, mode, permissionMode],
  )

  const trimmedInput = input.trimStart()
  const isSlashOpen = trimmedInput.startsWith('/') && !trimmedInput.includes('\n')
  const filteredSlash = useMemo(() => {
    if (!isSlashOpen) return []
    const q = trimmedInput.toLowerCase()
    return slashCommands.filter((item) => item.cmd.startsWith(q))
  }, [isSlashOpen, trimmedInput, slashCommands])

  useEffect(() => {
    setSlashIndex(0)
  }, [trimmedInput])

  const effectiveMissingBackend = simulateMissingBackend || daemon?.mode === 'missing_backend'

  const handleTogglePermission = useCallback(
    async (next: PermissionMode) => {
      setPermissionMode(next)
      if (sessionId && desktopApi.isLive()) {
        try {
          await desktopApi.updatePermission(sessionId, next)
        } catch {
          // ignore if session hasn't synced yet
        }
      }
    },
    [sessionId],
  )

  const handleOpenStudio = useCallback(() => {
    void openStudioInBrowser(desktopApi.getStudioUrl(sessionId))
  }, [sessionId])

  const executeSlashCommand = useCallback(
    (cmd: string) => {
      setInput('')
      switch (cmd) {
        case '/pick':
          void showPicker()
          break
        case '/mode':
          setMode((prev) => (prev === 'minimal' ? 'guarded' : 'minimal'))
          break
        case '/perm':
          void handleTogglePermission(permissionMode === 'auto' ? 'manual' : 'auto')
          break
        case '/studio':
          handleOpenStudio()
          break
        case '/settings':
          setShowConfigDrawer((prev) => !prev)
          break
        case '/clear':
          setEntries([])
          setPendingApproval(null)
          setCurrentStep(0)
          if (sessionId && desktopApi.isLive()) {
            void desktopApi.resetSession(sessionId)
          }
          break
      }
      window.setTimeout(() => textareaRef.current?.focus(), 20)
    },
    [handleOpenStudio, handleTogglePermission, permissionMode, sessionId],
  )

  const handleBootstrapUv = useCallback(async () => {
    setBootstrapping(true)
    setBootstrapError(null)
    setBootstrapLog(t.installingViaUv)
    try {
      const res = await bootstrapViaUv()
      if (res.success && res.daemon) {
        setDaemon(res.daemon)
        desktopApi.setBaseUrl(res.daemon.url)
        setBootstrapLog(null)
      } else {
        setBootstrapError(res.error || t.installFailed)
      }
    } catch (err) {
      setBootstrapError(err instanceof Error ? err.message : t.installFailed)
    } finally {
      setBootstrapping(false)
    }
  }, [t.installFailed, t.installingViaUv])

  const handleSaveConfig = useCallback(async (patch: ConfigPatch) => {
    const updated = await desktopApi.patchConfig(patch)
    setConfig(updated)
    if (updated.api_key_set) {
      window.setTimeout(() => setShowConfigDrawer(false), 750)
    }
  }, [])

  const applySessionEvent = useCallback((assistantId: string, ev: SessionEvent) => {
    const payload = ev.payload || {}
    if (typeof ev.step === 'number' && ev.step > 0) {
      setCurrentStep(ev.step)
    }

    switch (ev.event_type) {
      case 'reasoning_delta': {
        const delta = String(payload.delta ?? payload.text ?? payload.content ?? '')
        if (!delta) return
        setEntries((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? { ...item, reasoning: (item.reasoning || '') + delta, status: 'streaming' }
              : item,
          ),
        )
        break
      }
      case 'reasoning': {
        const full = String(payload.reasoning ?? payload.text ?? payload.content ?? '')
        if (!full) return
        setEntries((prev) =>
          prev.map((item) =>
            item.id === assistantId ? { ...item, reasoning: full, status: 'running' } : item,
          ),
        )
        break
      }
      case 'talk_delta':
      case 'content_delta': {
        const delta = String(payload.delta ?? payload.text ?? payload.content ?? '')
        if (!delta) return
        setEntries((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? { ...item, text: item.text + delta, status: 'streaming' }
              : item,
          ),
        )
        break
      }
      case 'talk':
      case 'message': {
        const msg = String(payload.message ?? payload.text ?? payload.content ?? '')
        if (!msg) return
        setEntries((prev) =>
          prev.map((item) =>
            item.id === assistantId ? { ...item, text: msg, status: 'running' } : item,
          ),
        )
        break
      }
      case 'action_proposed':
      case 'action_executed': {
        const { summary, detail } = summarizeAction(payload)
        const chip: ActionChipItem = {
          id: `${ev.event_type}-${ev.step}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          step: ev.step,
          summary,
          detail,
          status: ev.event_type === 'action_executed' ? 'executed' : 'proposed',
        }
        setEntries((prev) =>
          prev.map((item) => {
            if (item.id !== assistantId) return item
            const existing = item.actions ?? []
            if (
              ev.event_type === 'action_executed' &&
              existing.length > 0 &&
              existing[existing.length - 1].step === ev.step &&
              existing[existing.length - 1].status === 'proposed'
            ) {
              const updated = [...existing]
              updated[updated.length - 1] = { ...updated[updated.length - 1], status: 'executed' }
              return { ...item, actions: updated }
            }
            return { ...item, actions: [...existing, chip] }
          }),
        )
        break
      }
      case 'approval_required': {
        setPendingApproval({
          action: String(payload.action ?? payload.action_type ?? 'action'),
          code_snippet: typeof payload.code_snippet === 'string' ? payload.code_snippet : undefined,
          description:
            typeof payload.description === 'string'
              ? payload.description
              : typeof payload.context === 'string'
                ? payload.context
                : undefined,
          params:
            payload.params && typeof payload.params === 'object'
              ? (payload.params as Record<string, unknown>)
              : undefined,
        })
        break
      }
      case 'approval_resolved': {
        setPendingApproval(null)
        break
      }
      case 'task_completed':
      case 'turn_finished': {
        setIsRunning(false)
        setPendingApproval(null)
        void hideTargetBorder()
        const finalSummary = String(payload.message ?? payload.summary ?? '')
        setEntries((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  text: item.text || finalSummary,
                  status: 'completed',
                }
              : item,
          ),
        )
        break
      }
      case 'aborted': {
        setIsRunning(false)
        setPendingApproval(null)
        void hideTargetBorder()
        setEntries((prev) =>
          prev.map((item) =>
            item.id === assistantId ? { ...item, status: 'aborted' } : item,
          ),
        )
        break
      }
      case 'error': {
        setIsRunning(false)
        setPendingApproval(null)
        void hideTargetBorder()
        const errText = String(payload.error ?? payload.message ?? 'Unknown error')
        setEntries((prev) =>
          prev.map((item) =>
            item.id === assistantId ? { ...item, status: 'error', error: errText } : item,
          ),
        )
        break
      }
    }
  }, [])

  const runPreviewSimulation = useCallback(
    (assistantId: string, promptText: string) => {
      previewTimersRef.current.forEach((id) => window.clearTimeout(id))
      previewTimersRef.current = []

      const isZh = locale === 'zh-CN'
      const reasoningChunks = isZh
        ? [
            '已捕获目标视口，正在识别界面主操作区域… ',
            '定位到目标按钮坐标 (642, 318)，准备执行点击与输入操作。',
          ]
        : [
            'Captured bound viewport and located primary controls… ',
            'Target control aligned at (642, 318); preparing precision input.',
          ]

      const talkChunks = isZh
        ? [
            `已在「${primaryTarget?.title ?? '目标窗口'}」上完成「`,
            promptText.slice(0, 32),
            '」的执行流程，视口状态已验证正常。',
          ]
        : [
            `Completed “${promptText.slice(0, 32)}” inside `,
            primaryTarget?.title ?? 'bound viewport',
            ' and verified the updated state.',
          ]

      const schedule = (ms: number, fn: () => void) => {
        const id = window.setTimeout(fn, ms)
        previewTimersRef.current.push(id)
      }

      schedule(180, () => {
        applySessionEvent(assistantId, {
          session_id: 'preview',
          event_type: 'reasoning_delta',
          step: 1,
          payload: { delta: reasoningChunks[0] },
          timestamp: Date.now(),
        })
      })
      schedule(520, () => {
        applySessionEvent(assistantId, {
          session_id: 'preview',
          event_type: 'reasoning_delta',
          step: 1,
          payload: { delta: reasoningChunks[1] },
          timestamp: Date.now(),
        })
      })
      schedule(840, () => {
        applySessionEvent(assistantId, {
          session_id: 'preview',
          event_type: 'action_proposed',
          step: 1,
          payload: { code: 'click(642, 318)\nwait(0.3)' },
          timestamp: Date.now(),
        })
      })

      if (permissionMode === 'manual') {
        schedule(1000, () => {
          applySessionEvent(assistantId, {
            session_id: 'preview',
            event_type: 'approval_required',
            step: 1,
            payload: {
              action: 'click',
              code_snippet: 'click(642, 318)',
              description: isZh ? '点击目标视口坐标 (642, 318)' : 'Click target viewport at (642, 318)',
            },
            timestamp: Date.now(),
          })
        })
        return
      }

      schedule(1220, () => {
        applySessionEvent(assistantId, {
          session_id: 'preview',
          event_type: 'action_executed',
          step: 1,
          payload: { code: 'click(642, 318)' },
          timestamp: Date.now(),
        })
      })
      schedule(1520, () => {
        applySessionEvent(assistantId, {
          session_id: 'preview',
          event_type: 'talk_delta',
          step: 2,
          payload: { delta: talkChunks[0] },
          timestamp: Date.now(),
        })
      })
      schedule(1780, () => {
        applySessionEvent(assistantId, {
          session_id: 'preview',
          event_type: 'talk_delta',
          step: 2,
          payload: { delta: talkChunks[1] + talkChunks[2] },
          timestamp: Date.now(),
        })
      })
      schedule(2040, () => {
        applySessionEvent(assistantId, {
          session_id: 'preview',
          event_type: 'task_completed',
          step: 2,
          payload: {},
          timestamp: Date.now(),
        })
      })
    },
    [applySessionEvent, locale, permissionMode, primaryTarget?.title],
  )

  const handleSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault()
      const text = input.trim()
      if (!text || isRunning) return

      if (text.startsWith('/')) {
        const match = filteredSlash[slashIndex] ?? slashCommands.find((c) => c.cmd === text.toLowerCase())
        if (match) {
          executeSlashCommand(match.cmd)
          return
        }
      }

      if (effectiveMissingBackend) return

      const userId = `u-${Date.now()}`
      const assistantId = `a-${Date.now() + 1}`

      setInput('')
      setIsRunning(true)
      setCurrentStep(1)
      setPendingApproval(null)
      setEntries((prev) => [
        ...prev,
        { id: userId, role: 'user', text },
        { id: assistantId, role: 'assistant', text: '', status: 'streaming', actions: [] },
      ])

      if (primaryTarget && primaryTarget.rect.width > 0 && primaryTarget.rect.height > 0) {
        void showTargetBorder(
          primaryTarget.rect.x,
          primaryTarget.rect.y,
          primaryTarget.rect.width,
          primaryTarget.rect.height,
          primaryTarget.title,
        )
      }

      // Offline browser preview path
      if (!desktopApi.isLive()) {
        runPreviewSimulation(assistantId, text)
        return
      }

      try {
        let activeSessionId = sessionId
        if (!activeSessionId) {
          const targetIds =
            selectedTargets.length > 1 ? selectedTargets.map((item) => item.target_id) : undefined
          const created = await desktopApi.createSession({
            target_id: primaryTarget?.target_id || 'display:1',
            target_ids: targetIds,
            region: selectedRegion,
            cdp_ws_url: selectedCdpWsUrl,
            mode,
            permission_mode: permissionMode,
          })
          activeSessionId = created.session_id
          setSessionId(created.session_id)
        }

        const wsUrl = desktopApi.getSessionWsUrl(activeSessionId)
        if (wsUrl) {
          wsRef.current?.close()
          const ws = new WebSocket(wsUrl)
          wsRef.current = ws
          ws.onopen = () => {
            ws.send(JSON.stringify({ action: 'message', instruction: text, max_steps: 50 }))
          }
          ws.onmessage = (msg) => {
            try {
              const ev = JSON.parse(msg.data) as SessionEvent
              applySessionEvent(assistantId, ev)
            } catch {
              // ignore non-JSON frames
            }
          }
          ws.onerror = () => {
            void desktopApi.sendMessage(activeSessionId!, text).catch((err) => {
              applySessionEvent(assistantId, {
                session_id: activeSessionId!,
                event_type: 'error',
                step: 0,
                payload: { error: err instanceof Error ? err.message : String(err) },
                timestamp: Date.now(),
              })
            })
          }
        } else {
          await desktopApi.sendMessage(activeSessionId, text)
        }
      } catch (err) {
        applySessionEvent(assistantId, {
          session_id: sessionId || 'error',
          event_type: 'error',
          step: 0,
          payload: { error: err instanceof Error ? err.message : String(err) },
          timestamp: Date.now(),
        })
      }
    },
    [
      applySessionEvent,
      effectiveMissingBackend,
      executeSlashCommand,
      filteredSlash,
      input,
      isRunning,
      mode,
      permissionMode,
      primaryTarget,
      runPreviewSimulation,
      selectedCdpWsUrl,
      selectedRegion,
      selectedTargets,
      sessionId,
      slashCommands,
      slashIndex,
    ],
  )

  const handleStop = useCallback(async () => {
    previewTimersRef.current.forEach((id) => window.clearTimeout(id))
    previewTimersRef.current = []
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'abort' }))
    } else if (sessionId && desktopApi.isLive()) {
      await desktopApi.abortSession(sessionId).catch(() => {})
    }
    setIsRunning(false)
    setPendingApproval(null)
    void hideTargetBorder()
    setEntries((prev) =>
      prev.map((item, idx) =>
        idx === prev.length - 1 && item.role === 'assistant'
          ? { ...item, status: 'aborted' }
          : item,
      ),
    )
  }, [sessionId])

  const handleApprovalDecision = useCallback(
    async (approved: boolean) => {
      setPendingApproval(null)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'approval', approved }))
        return
      }
      if (sessionId && desktopApi.isLive()) {
        await desktopApi.submitApproval(sessionId, approved).catch(() => {})
        return
      }
      // Browser preview continuation
      const lastAssistant = [...entries].reverse().find((e) => e.role === 'assistant')
      if (!lastAssistant) return
      if (!approved) {
        applySessionEvent(lastAssistant.id, {
          session_id: 'preview',
          event_type: 'aborted',
          step: currentStep,
          payload: {},
          timestamp: Date.now(),
        })
        return
      }
      applySessionEvent(lastAssistant.id, {
        session_id: 'preview',
        event_type: 'action_executed',
        step: currentStep,
        payload: { code: 'click(642, 318)' },
        timestamp: Date.now(),
      })
      window.setTimeout(() => {
        applySessionEvent(lastAssistant.id, {
          session_id: 'preview',
          event_type: 'talk',
          step: currentStep + 1,
          payload: {
            message:
              locale === 'zh-CN'
                ? '已按批准执行操作，目标视口状态已更新。'
                : 'Approved action executed cleanly; target viewport updated.',
          },
          timestamp: Date.now(),
        })
        applySessionEvent(lastAssistant.id, {
          session_id: 'preview',
          event_type: 'task_completed',
          step: currentStep + 1,
          payload: {},
          timestamp: Date.now(),
        })
      }, 420)
    },
    [applySessionEvent, currentStep, entries, locale, sessionId],
  )

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashOpen && filteredSlash.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashIndex((idx) => (idx + 1) % filteredSlash.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashIndex((idx) => (idx - 1 + filteredSlash.length) % filteredSlash.length)
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        setInput(filteredSlash[slashIndex].cmd)
        return
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      if (isSlashOpen) {
        setInput('')
      } else if (showConfigDrawer) {
        setShowConfigDrawer(false)
      } else {
        void hideCommand()
      }
      return
    }

    // IME-safe Enter-to-submit (guards both standard isComposing and Safari/WebKit keyCode === 229)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
        return
      }
      if (isSlashOpen && filteredSlash.length > 0) {
        executeSlashCommand(filteredSlash[slashIndex].cmd)
        return
      }
      formRef.current?.requestSubmit()
    }
  }

  const targetSummaryText = primaryTarget
    ? `${primaryTarget.title} · ${Math.round(primaryTarget.rect.width)}×${Math.round(primaryTarget.rect.height)}`
    : t.pickTargetPrompt

  const hasText = input.trim().length > 0

  return (
    <div className="flex w-full justify-center px-1 py-1">
      <div
        ref={cardRef}
        className="aef-glass relative w-full max-w-[640px] overflow-hidden rounded-2xl text-slate-100"
      >
        {/* Subtle top ambient hairline accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/55 to-transparent"
        />

        {/* Compact 38px Top Toolbar */}
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label={t.commandToolbarAria}
          {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return
            void startWindowDrag()
          }}
          className="flex h-[38px] items-center justify-between gap-2 border-b border-white/[0.07] px-2.5 select-none cursor-grab active:cursor-grabbing"
        >
          {/* Left: Brand + Target Badge + Add Target */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-flex items-center justify-center pl-0.5 text-indigo-400 shrink-0">
              <AEFlowMark className="w-4 h-4" />
            </span>

            <button
              type="button"
              onClick={() => void showPicker()}
              title={targetSummaryText}
              className="aef-toolbar-btn aef-smooth-transition inline-flex max-w-[235px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] px-2 py-1 text-xs font-medium text-slate-200 hover:border-indigo-400/35 hover:bg-white/[0.09] min-w-0"
            >
              <TargetTypeIcon
                type={primaryTarget?.target_type ?? 'window'}
                className="w-3.5 h-3.5 text-cyan-300/90 shrink-0"
              />
              <span className="truncate">{targetSummaryText}</span>
              {selectedTargets.length > 1 && (
                <span className="rounded bg-indigo-500/25 px-1 text-[10px] font-semibold text-indigo-200 shrink-0">
                  +{selectedTargets.length - 1}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void showPicker()}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/[0.07] hover:text-slate-100"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
              <span>{t.addTarget.replace(/^\+\s*/, '')}</span>
            </button>
          </div>

          {/* Right: Auto/Approve segmented toggle, Studio link, Settings, Locale, Collapse */}
          <div className="flex items-center gap-1 shrink-0">
            <div
              role="group"
              aria-label={t.permGroupAria}
              className="inline-flex items-center rounded-lg border border-white/10 bg-slate-950/60 p-0.5"
            >
              <button
                type="button"
                aria-pressed={permissionMode === 'auto'}
                onClick={() => void handleTogglePermission('auto')}
                className="aef-toolbar-btn aef-smooth-transition rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-100"
              >
                {t.permAuto}
              </button>
              <button
                type="button"
                aria-pressed={permissionMode === 'manual'}
                onClick={() => void handleTogglePermission('manual')}
                className="aef-toolbar-btn aef-smooth-transition rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-100"
              >
                {t.permManual}
              </button>
            </div>

            <span
              role="separator"
              aria-orientation="vertical"
              className="mx-0.5 h-3.5 border-l border-white/10"
            />

            <button
              type="button"
              onClick={handleOpenStudio}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              <span>{t.openStudio}</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-pressed={showConfigDrawer}
              aria-label={t.settingsAria}
              title={t.settingsAria}
              onClick={() => setShowConfigDrawer((prev) => !prev)}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center justify-center rounded-lg px-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
            >
              <Settings className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-action="toggle-locale"
              data-testid="locale-toggle"
              aria-label={t.localeSwitchAria}
              title={t.localeSwitchAria}
              onClick={onToggleLocale}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1 rounded-lg px-1.5 text-[11px] font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>{t.localeSwitchLabel}</span>
            </button>

            {(isRunning || entries.length > 0) && (
              <button
                type="button"
                aria-label={t.collapseToPillAria}
                title={t.collapseToPillAria}
                onClick={() =>
                  void collapseToPill(
                    sessionId || 'preview-session',
                    primaryTarget?.title || t.appName,
                  )
                }
                className="aef-toolbar-btn aef-smooth-transition inline-flex items-center justify-center rounded-lg px-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-slate-100"
              >
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Hero Command Input Row */}
        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="px-4 py-3">
          <label htmlFor={inputId} className="sr-only">
            {t.commandInputLabel}
          </label>
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              id={inputId}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={t.commandPlaceholder}
              disabled={effectiveMissingBackend}
              autoFocus
              className="aef-command-textarea flex-1 bg-transparent py-1 text-[15px] leading-relaxed text-slate-50 placeholder:text-slate-500 focus:outline-none disabled:opacity-45"
            />

            {isRunning ? (
              <button
                type="button"
                onClick={() => void handleStop()}
                aria-label={t.stopExecution}
                title={t.stopExecution}
                className="aef-smooth-transition inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/20 px-3 text-xs font-medium text-rose-100 hover:bg-rose-500/30"
              >
                <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                <span>{t.stopExecution}</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!hasText || effectiveMissingBackend}
                aria-label={t.sendActionAria}
                title={t.sendActionAria}
                className={`aef-smooth-transition inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                  hasText && !effectiveMissingBackend
                    ? 'border-indigo-400/60 bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400'
                    : 'border-white/10 bg-white/[0.04] text-slate-500 cursor-default'
                }`}
              >
                <EnterReturnIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Slash Command Menu (`/`) */}
        {isSlashOpen && filteredSlash.length > 0 && (
          <div
            role="listbox"
            aria-label={t.slashMenuAria}
            className="aef-fade-in border-t border-white/10 bg-slate-950/65 px-2 py-1.5"
          >
            {filteredSlash.map((item, idx) => {
              const active = idx === slashIndex
              return (
                <button
                  key={item.cmd}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setSlashIndex(idx)}
                  onClick={() => executeSlashCommand(item.cmd)}
                  className={`aef-smooth-transition flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs ${
                    active ? 'bg-indigo-500/20 text-indigo-100' : 'text-slate-300 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-semibold text-indigo-300 shrink-0">
                      {item.label}
                    </span>
                    <span className="truncate text-slate-400">{item.desc}</span>
                  </div>
                  {item.meta && (
                    <span className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-300 whitespace-nowrap shrink-0">
                      {item.meta}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* One-Click uv Onboarding Banner (only when missing_backend) */}
        {effectiveMissingBackend && (
          <section
            aria-label={t.missingBackendTitle}
            className="aef-fade-in border-t border-white/10 bg-slate-950/65 px-4 py-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                  <h2 className="text-xs font-semibold text-slate-100">{t.missingBackendTitle}</h2>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {t.missingBackendDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void restartDaemon().then((res) => {
                  setDaemon(res)
                  desktopApi.setBaseUrl(res.url)
                })}
                aria-label={t.restartEngine}
                title={t.restartEngine}
                className="aef-toolbar-btn aef-smooth-transition inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bootstrapping}
                onClick={() => void handleBootstrapUv()}
                className="aef-smooth-transition inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white shadow-md hover:bg-indigo-400 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{bootstrapping ? t.installingViaUv : t.installViaUv}</span>
              </button>

              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300">
                <Terminal className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                <code className="font-mono text-cyan-200/95">
                  {daemon?.install_hint || 'uv tool install agenteverywhereflow'}
                </code>
                <CopyCommandButton
                  text={daemon?.install_hint || 'uv tool install agenteverywhereflow'}
                  ariaLabel={t.copyCommandAria}
                  copiedLabel={t.copied}
                  failedLabel={t.copyFailed}
                />
              </div>
            </div>

            {bootstrapLog && (
              <p className="mt-2 font-mono text-[11px] text-indigo-300/90">{bootstrapLog}</p>
            )}
            {bootstrapError && (
              <p role="alert" className="mt-2 text-[11px] text-rose-300">
                {bootstrapError}
              </p>
            )}
          </section>
        )}

        {/* Inline Quick-Config Drawer (when API key unset or toggled) */}
        {showConfigDrawer && !effectiveMissingBackend && (
          <InlineConfigDrawer
            config={config}
            t={t}
            missingKeyBanner={config?.api_key_set === false}
            onSave={handleSaveConfig}
            onClose={() => setShowConfigDrawer(false)}
          />
        )}

        {/* Smoothly Expanded Conversational Execution Stream */}
        {entries.length > 0 && !effectiveMissingBackend && (
          <div className="aef-fade-in border-t border-white/[0.08] bg-slate-950/45">
            <div className="max-h-[296px] space-y-3 overflow-y-auto px-4 py-3">
              {entries.map((entry) => {
                if (entry.role === 'user') {
                  return (
                    <div key={entry.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-indigo-400/25 bg-indigo-500/15 px-3 py-1.5 text-xs leading-relaxed text-indigo-50">
                        {entry.text}
                      </div>
                    </div>
                  )
                }

                const reasoningOpen = expandedReasoning[entry.id] ?? false

                return (
                  <div key={entry.id} className="space-y-2">
                    {/* Collapsible Reasoning Delta Block */}
                    {entry.reasoning && (
                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5">
                        <button
                          type="button"
                          aria-expanded={reasoningOpen}
                          onClick={() =>
                            setExpandedReasoning((prev) => ({
                              ...prev,
                              [entry.id]: !reasoningOpen,
                            }))
                          }
                          className="flex w-full items-center gap-1.5 text-left text-[11px] font-medium text-slate-400 hover:text-slate-200"
                        >
                          {reasoningOpen ? (
                            <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                          )}
                          <span className="whitespace-nowrap shrink-0">{t.thinkingLabel}</span>
                          {!reasoningOpen && (
                            <span className="truncate font-normal text-slate-500">
                              — {entry.reasoning}
                            </span>
                          )}
                        </button>
                        {reasoningOpen && (
                          <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
                            {entry.reasoning}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Compact Collapsible Action Chips */}
                    {entry.actions && entry.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.actions.map((chip) => {
                          const open = expandedChips[chip.id] ?? false
                          return (
                            <div key={chip.id} className="max-w-full">
                              <button
                                type="button"
                                aria-expanded={open}
                                onClick={() =>
                                  setExpandedChips((prev) => ({ ...prev, [chip.id]: !open }))
                                }
                                className="aef-smooth-transition inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/75 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-indigo-400/35 hover:text-white"
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                    chip.status === 'executed'
                                      ? 'bg-emerald-400'
                                      : 'bg-cyan-400'
                                  }`}
                                  aria-hidden="true"
                                />
                                <span className="text-slate-500 shrink-0">
                                  {t.stepPrefix} {chip.step}
                                </span>
                                <span className="truncate">{chip.summary}</span>
                              </button>
                              {open && (
                                <pre className="mt-1 overflow-x-auto rounded-lg border border-white/10 bg-slate-950/90 p-2 font-mono text-[11px] text-cyan-200/90">
                                  <code>{chip.detail}</code>
                                </pre>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Assistant Conversational Text / Status */}
                    {entry.text ? (
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-100">
                        {entry.text}
                      </p>
                    ) : entry.status === 'streaming' || entry.status === 'running' ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="aef-pulse-dot h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        <span>{t.noOutputYet}</span>
                      </div>
                    ) : null}

                    {entry.error && (
                      <p
                        role="alert"
                        className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200"
                      >
                        {entry.error}
                      </p>
                    )}
                  </div>
                )
              })}

              {/* Inline Manual Approval Bar */}
              {pendingApproval && (
                <div className="aef-fade-in rounded-xl border border-amber-400/30 bg-amber-950/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                        <span>{t.approvalRequiredTitle}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] text-amber-100/90">
                        {pendingApproval.code_snippet ||
                          pendingApproval.description ||
                          pendingApproval.action}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleApprovalDecision(false)}
                        className="aef-smooth-transition inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-rose-400/40 hover:bg-rose-500/20 hover:text-rose-100 whitespace-nowrap shrink-0"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.rejectAction}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleApprovalDecision(true)}
                        className="aef-smooth-transition inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.approveAction}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={streamEndRef} />
            </div>

            {/* Quiet Footer Status Strip */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    pendingApproval
                      ? 'aef-pulse-dot bg-amber-400'
                      : isRunning
                        ? 'aef-pulse-dot bg-emerald-400'
                        : 'bg-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {pendingApproval
                    ? t.statusWaitingApproval
                    : isRunning
                      ? `${t.statusRunning} · ${t.stepPrefix} ${currentStep}`
                      : daemon?.version === 'preview'
                        ? t.daemonDemoMode
                        : daemon?.mode === 'spawned'
                          ? t.daemonSpawned
                          : t.daemonAttached}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">
                  {mode === 'minimal' ? t.modeMinimal : t.modeGuarded}
                </span>
              </div>

              <button
                type="button"
                onClick={() => executeSlashCommand('/clear')}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" />
                <span>{t.clearConversation}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
