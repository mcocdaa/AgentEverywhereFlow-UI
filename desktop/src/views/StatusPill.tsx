import { useCallback, useEffect, useState } from 'react'
import { Check, Maximize2, ShieldAlert, Square, X } from 'lucide-react'
import type { Translations } from '../i18n/translations'
import { desktopApi } from '../lib/api'
import {
  expandFromPill,
  getPillState,
  hideTargetBorder,
  isTauri,
  onPreviewAction,
  resizePillWindow,
  startWindowDrag,
  tauriListen,
} from '../lib/tauri'
import type { GlobalBusEvent, PendingApproval, SessionState } from '../lib/types'

interface StatusPillProps {
  t: Translations
  daemonUrl?: string | null
  initialSessionId?: string | null
  initialLabel?: string
  simulatedApproval?: PendingApproval | null
  onClearSimulatedApproval?: () => void
}

interface PillStateEvent {
  session_id: string
  label: string
}

export function StatusPill({
  t,
  daemonUrl = null,
  initialSessionId,
  initialLabel,
  simulatedApproval = null,
  onClearSimulatedApproval,
}: StatusPillProps) {
  const inNativeTauri = isTauri()
  const [sessionId, setSessionId] = useState<string | null>(
    initialSessionId !== undefined ? initialSessionId : inNativeTauri ? null : 'preview-session',
  )
  const [label, setLabel] = useState(
    initialLabel !== undefined ? initialLabel : inNativeTauri ? '' : 'Chrome — Q4 Revenue Dashboard',
  )
  const [step, setStep] = useState(inNativeTauri ? 1 : 3)
  const [state, setState] = useState<SessionState>('running')
  const [liveApproval, setLiveApproval] = useState<PendingApproval | null>(null)
  const [busyAction, setBusyAction] = useState(false)

  const activeApproval = liveApproval ?? simulatedApproval

  // Resize native pill window smoothly when approval drawer opens/closes
  useEffect(() => {
    if (!inNativeTauri) return
    if (activeApproval) {
      void resizePillWindow(392, 114)
    } else {
      void resizePillWindow(360, 44)
    }
  }, [activeApproval, inNativeTauri])

  // Hydrate initial pill state from Rust managed OverlayState + listen to subsequent IPC updates
  useEffect(() => {
    let active = true
    let cleanup: (() => void) | undefined
    if (inNativeTauri) {
      void getPillState().then((snapshot) => {
        if (!active || !snapshot) return
        setSessionId(snapshot.session_id)
        setLabel(snapshot.label)
      })
      void tauriListen<PillStateEvent>('aeflow://pill-state', (payload) => {
        setSessionId(payload.session_id)
        setLabel(payload.label)
        setState('running')
        setStep(1)
        setLiveApproval(null)
      }).then((unlisten) => {
        if (!active) {
          unlisten()
        } else {
          cleanup = unlisten
        }
      })
    } else {
      cleanup = onPreviewAction((action) => {
        if (action.type === 'pill-state') {
          setSessionId(action.session_id)
          setLabel(action.label)
          setState('running')
        }
      })
    }
    return () => {
      active = false
      cleanup?.()
    }
  }, [inNativeTauri])

  // Subscribe to global backend event bus WS `/api/v1/events`
  useEffect(() => {
    if (daemonUrl) {
      desktopApi.setBaseUrl(daemonUrl)
    }
    const wsUrl = desktopApi.getGlobalEventsWsUrl()
    if (!wsUrl) return

    let ws: WebSocket | null = null
    let reconnectTimer: number | null = null
    let closed = false

    const connect = () => {
      if (closed) return
      try {
        ws = new WebSocket(wsUrl)
        ws.onmessage = (msg) => {
          try {
            const ev = JSON.parse(msg.data) as GlobalBusEvent
            if (sessionId && ev.session_id && ev.session_id !== sessionId) return

            const payload = (ev.payload ?? {}) as Record<string, unknown>
            const nextStep =
              typeof payload.step === 'number'
                ? payload.step
                : typeof ev.step === 'number'
                  ? ev.step
                  : null
            if (nextStep !== null && nextStep > 0) {
              setStep(nextStep)
            }

            const nextLabel =
              (typeof payload.title === 'string' && payload.title) ||
              (typeof payload.label === 'string' && payload.label) ||
              ev.label
            if (nextLabel) setLabel(nextLabel)

            if (ev.event_type === 'approval_required') {
              setState('waiting_approval')
              const raw = ev.approval ?? (ev.payload as Partial<PendingApproval> | undefined)
              const actionName = String(raw?.action ?? raw?.action_type ?? 'action')
              setLiveApproval({
                action: actionName,
                action_type: typeof raw?.action_type === 'string' ? raw.action_type : undefined,
                code_snippet: typeof raw?.code_snippet === 'string' ? raw.code_snippet : undefined,
                description:
                  typeof raw?.description === 'string'
                    ? raw.description
                    : typeof raw?.context === 'string'
                      ? raw.context
                      : actionName,
                params:
                  raw?.params && typeof raw.params === 'object'
                    ? raw.params
                    : payload.details && typeof payload.details === 'object'
                      ? (payload.details as Record<string, unknown>)
                      : undefined,
              })
            } else if (ev.event_type === 'approval_resolved') {
              setLiveApproval(null)
              setState('running')
            } else if (ev.event_type === 'session_state_changed') {
              const nextState = (
                typeof payload.state === 'string' ? payload.state : ev.state
              ) as SessionState | undefined
              if (nextState) {
                setState(nextState)
                if (nextState !== 'waiting_approval') {
                  setLiveApproval(null)
                }
              }
            } else if (
              ev.event_type === 'task_completed' ||
              ev.event_type === 'aborted' ||
              ev.event_type === 'session_deleted'
            ) {
              setState(ev.event_type === 'aborted' ? 'aborted' : 'idle')
              setLiveApproval(null)
            }
          } catch {
            // ignore malformed event payload
          }
        }
        ws.onclose = () => {
          if (!closed) {
            reconnectTimer = window.setTimeout(connect, 2500)
          }
        }
      } catch {
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 3000)
        }
      }
    }

    connect()
    return () => {
      closed = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [sessionId, daemonUrl])

  const handleStop = useCallback(async () => {
    setBusyAction(true)
    try {
      if (sessionId && desktopApi.isLive()) {
        await desktopApi.abortSession(sessionId)
      }
      setState('aborted')
      setLiveApproval(null)
      onClearSimulatedApproval?.()
      await hideTargetBorder()
    } finally {
      setBusyAction(false)
    }
  }, [sessionId, onClearSimulatedApproval])

  const handleApproval = useCallback(
    async (approved: boolean) => {
      setBusyAction(true)
      try {
        if (sessionId && desktopApi.isLive()) {
          await desktopApi.submitApproval(sessionId, approved)
        }
        setLiveApproval(null)
        onClearSimulatedApproval?.()
        setState(approved ? 'running' : 'idle')
      } finally {
        setBusyAction(false)
      }
    },
    [sessionId, onClearSimulatedApproval],
  )

  const handleExpand = useCallback(async () => {
    await expandFromPill()
  }, [])

  const isWaitingApproval = Boolean(activeApproval) || state === 'waiting_approval'
  const isRunning = state === 'running'

  const approvalSummary =
    activeApproval?.description ||
    activeApproval?.code_snippet ||
    activeApproval?.action ||
    t.pillApprovalNeeded

  return (
    <div className="flex w-full justify-center">
      <div
        className={`aef-glass-subtle aef-smooth-transition overflow-hidden text-slate-100 ${
          activeApproval ? 'w-[392px] rounded-2xl' : 'w-[360px] rounded-full'
        }`}
      >
        {/* Main 44px capsule row */}
        <div
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return
            void startWindowDrag()
          }}
          className="flex h-[44px] items-center justify-between gap-2 px-3.5 select-none cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isWaitingApproval
                  ? 'aef-pulse-dot bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                  : isRunning
                    ? 'aef-pulse-dot bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                    : 'bg-slate-400'
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-slate-100 whitespace-nowrap shrink-0">
              {isWaitingApproval
                ? t.pillApprovalNeeded
                : isRunning
                  ? `${t.pillRunning} · ${t.pillStep} ${step}`
                  : t.pillIdle}
            </span>
            {label && !isWaitingApproval && (
              <>
                <span className="text-slate-600 shrink-0">·</span>
                <span className="truncate text-[11px] text-slate-400">{label}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={busyAction}
              onClick={handleStop}
              aria-label={t.pillStop}
              title={t.pillStop}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/12 px-2 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-500/22 disabled:opacity-50"
            >
              <Square className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
              <span>{t.pillStop}</span>
            </button>
            <button
              type="button"
              onClick={handleExpand}
              aria-label={t.pillExpand}
              title={t.pillExpand}
              className="aef-toolbar-btn aef-smooth-transition inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/14"
            >
              <Maximize2 className="w-2.5 h-2.5" aria-hidden="true" />
              <span>{t.pillExpand}</span>
            </button>
          </div>
        </div>

        {/* Inline quick-approve drawer on approval_required */}
        {activeApproval && (
          <div className="aef-fade-in border-t border-amber-400/20 bg-amber-950/25 px-3.5 py-2.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-200/95">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="truncate font-mono">{approvalSummary}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleApproval(false)}
                className="aef-smooth-transition inline-flex items-center gap-1 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-rose-500/20 hover:border-rose-400/35 hover:text-rose-100 whitespace-nowrap shrink-0"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                <span>{t.pillReject}</span>
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleApproval(true)}
                className="aef-smooth-transition inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
              >
                <Check className="w-3 h-3" aria-hidden="true" />
                <span>{t.pillApprove}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
