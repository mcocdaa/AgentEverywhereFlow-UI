import type {
  BootstrapResult,
  DaemonDiscoveryResult,
  DesktopView,
  PickerSelectionPayload,
} from './types'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: Record<string, unknown>
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined'
}

// Browser preview internal event bus so switching views in dev preview stays stateful & interactive
const PREVIEW_CHANNEL = 'aeflow-desktop-preview'

type PreviewAction =
  | { type: 'switch-view'; view: DesktopView }
  | { type: 'target-selected'; payload: PickerSelectionPayload }
  | { type: 'border-update'; label: string; x: number; y: number; width: number; height: number }
  | { type: 'pill-state'; session_id: string; label: string }
  | { type: 'expand-command' }

function emitPreview(action: PreviewAction): void {
  window.dispatchEvent(new CustomEvent<PreviewAction>(PREVIEW_CHANNEL, { detail: action }))
}

export function onPreviewAction(handler: (action: PreviewAction) => void): () => void {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<PreviewAction>
    if (custom.detail) handler(custom.detail)
  }
  window.addEventListener(PREVIEW_CHANNEL, listener)
  return () => window.removeEventListener(PREVIEW_CHANNEL, listener)
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export async function tauriListen<T>(
  eventName: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (!isTauri()) {
    return () => {}
  }
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<T>(eventName, (event) => handler(event.payload))
  return unlisten
}

export async function startWindowDrag(): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().startDragging()
  } catch {
    // ignore drag error outside Tauri
  }
}

export async function discoverOrStartDaemon(): Promise<DaemonDiscoveryResult> {
  if (isTauri()) {
    return tauriInvoke<DaemonDiscoveryResult>('discover_or_start_daemon')
  }
  // Browser preview: try local daemon on 127.0.0.1:8000 first, gracefully fallback to preview mode
  const candidates = ['http://127.0.0.1:8000']
  for (const url of candidates) {
    try {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 500)
      const res = await fetch(`${url}/api/v1/health`, { signal: controller.signal })
      window.clearTimeout(timer)
      if (res.ok) {
        const data = (await res.json()) as { version?: string }
        return {
          url,
          mode: 'attached',
          install_hint: 'uv tool install agenteverywhereflow',
          has_uv: true,
          version: data.version ?? null,
        }
      }
    } catch {
      // local daemon not listening
    }
  }
  return {
    url: null,
    mode: 'attached',
    install_hint: 'uv tool install agenteverywhereflow',
    has_uv: true,
    version: 'preview',
    message: 'Browser preview mode',
  }
}

export async function restartDaemon(): Promise<DaemonDiscoveryResult> {
  if (isTauri()) {
    return tauriInvoke<DaemonDiscoveryResult>('restart_daemon')
  }
  return discoverOrStartDaemon()
}

export async function bootstrapViaUv(): Promise<BootstrapResult> {
  if (isTauri()) {
    return tauriInvoke<BootstrapResult>('bootstrap_via_uv')
  }
  await new Promise((resolve) => window.setTimeout(resolve, 900))
  return {
    success: true,
    output: 'Installed agenteverywhereflow (preview simulation)',
    daemon: {
      url: null,
      mode: 'spawned',
      install_hint: 'uv tool install agenteverywhereflow',
      has_uv: true,
      version: 'preview',
    },
  }
}

export interface PillStateSnapshot {
  session_id: string
  label: string
}

export interface BorderStateSnapshot {
  label: string
  x: number
  y: number
  width: number
  height: number
}

export async function getPillState(): Promise<PillStateSnapshot | null> {
  if (!isTauri()) return null
  try {
    return await tauriInvoke<PillStateSnapshot | null>('get_pill_state')
  } catch {
    return null
  }
}

export async function getBorderState(): Promise<BorderStateSnapshot | null> {
  if (!isTauri()) return null
  try {
    return await tauriInvoke<BorderStateSnapshot | null>('get_border_state')
  } catch {
    return null
  }
}

export async function getSelfPid(): Promise<number | null> {
  if (!isTauri()) return null
  try {
    return await tauriInvoke<number>('get_self_pid')
  } catch {
    return null
  }
}

export async function showPicker(): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('show_picker')
    return
  }
  emitPreview({ type: 'switch-view', view: 'picker' })
}

export async function closePickerAndOpenCommand(
  selection: PickerSelectionPayload | null,
): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('close_picker_and_open_command', {
      targetJson: selection ? JSON.stringify(selection) : '',
    })
    return
  }
  if (selection) {
    emitPreview({ type: 'target-selected', payload: selection })
  }
  emitPreview({ type: 'switch-view', view: 'command' })
}

export async function resizeCommandWindow(height: number): Promise<void> {
  if (!isTauri()) return
  await tauriInvoke('resize_command_window', { height: Math.round(height) })
}

export async function showTargetBorder(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('show_target_border', { x, y, w, h, label })
    return
  }
  emitPreview({ type: 'border-update', label, x, y, width: w, height: h })
}

export async function hideTargetBorder(): Promise<void> {
  if (!isTauri()) return
  await tauriInvoke('hide_target_border')
}

export async function collapseToPill(sessionId: string, label: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('collapse_to_pill', { sessionId, label })
    return
  }
  emitPreview({ type: 'pill-state', session_id: sessionId, label })
  emitPreview({ type: 'switch-view', view: 'pill' })
}

export async function resizePillWindow(width: number, height: number): Promise<void> {
  if (!isTauri()) return
  await tauriInvoke('resize_pill_window', { width, height })
}

export async function expandFromPill(): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('expand_from_pill')
    return
  }
  emitPreview({ type: 'expand-command' })
  emitPreview({ type: 'switch-view', view: 'command' })
}

export async function openStudioInBrowser(url: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke('open_studio_in_browser', { url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function hideCommand(): Promise<void> {
  if (!isTauri()) return
  await tauriInvoke('hide_command')
}
