export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type TargetType = 'display' | 'window' | 'region' | 'cdp'

export interface TargetInfo {
  target_id: string
  target_type: TargetType
  title: string
  native_handle: number
  process_name: string
  is_minimized: boolean
  rect: Rect
  cdp_ws_url?: string
  url?: string
}

export interface RegionSpec {
  x: number
  y: number
  width: number
  height: number
  title?: string
  parent_target_id?: string
}

export interface CdpTargetInfo {
  id: string
  target_id: string
  title: string
  url: string
  ws_url: string
}

export type ExecutionMode = 'minimal' | 'guarded'
export type PermissionMode = 'auto' | 'manual'
export type SessionState =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'waiting_input'
  | 'aborted'
  | 'error'
  | 'closed'

export interface PendingApproval {
  action: string
  params?: Record<string, unknown>
  code_snippet?: string
  context?: string
  description?: string
  action_type?: string
  requested_at?: number
}

export interface SessionDetail {
  session_id: string
  title?: string
  target: {
    target_id: string
    title: string
    rect: Rect
  }
  mode: ExecutionMode
  permission_mode: PermissionMode
  state: SessionState
  turn_count?: number
  total_steps?: number
  pending_approval?: PendingApproval | null
}

export type SessionEventType =
  | 'session_start'
  | 'turn_start'
  | 'observe'
  | 'reasoning'
  | 'reasoning_delta'
  | 'talk'
  | 'talk_delta'
  | 'content_delta'
  | 'message'
  | 'action_proposed'
  | 'approval_required'
  | 'approval_resolved'
  | 'action_executed'
  | 'step_finished'
  | 'turn_finished'
  | 'task_completed'
  | 'aborted'
  | 'error'

export interface SessionEvent {
  session_id: string
  event_type: SessionEventType
  step: number
  payload: Record<string, unknown>
  timestamp: number
}

export interface GlobalBusEvent {
  event_type: string
  session_id?: string
  step?: number
  state?: SessionState
  label?: string
  approval?: PendingApproval
  payload?: Record<string, unknown>
}

export interface ConfigResponse {
  model_name: string
  base_url: string
  api_key_set: boolean
  api_key_preview?: string
  default_mode?: ExecutionMode
  default_permission?: PermissionMode
  summon_hotkey?: string
}

export interface ConfigPatch {
  api_key?: string
  model_name?: string
  base_url?: string
  default_mode?: ExecutionMode
  default_permission?: PermissionMode
  summon_hotkey?: string
}

export interface HealthResponse {
  status: string
  version: string
  active_sessions: number
}

export interface DaemonDiscoveryResult {
  url: string | null
  mode: 'attached' | 'spawned' | 'missing_backend'
  install_hint: string
  has_uv: boolean
  version?: string | null
  message?: string | null
}

export interface BootstrapResult {
  success: boolean
  output: string
  error?: string | null
  daemon?: DaemonDiscoveryResult | null
}

export interface PickerSelectionPayload {
  targets: TargetInfo[]
  region?: RegionSpec
  cdpTarget?: CdpTargetInfo
}

export type DesktopView = 'command' | 'picker' | 'border' | 'pill'
