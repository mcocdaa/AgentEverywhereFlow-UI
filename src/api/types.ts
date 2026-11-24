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

export interface CdpTargetsResponse {
  endpoint: string
  targets: CdpTargetInfo[]
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

export interface AppConfigResponse {
  model_name: string
  base_url: string
  api_key_set: boolean
  api_key_preview: string
  default_mode: ExecutionMode
  default_permission: PermissionMode
  summon_hotkey: string
}

export interface PatchConfigRequest {
  api_key?: string
  model_name?: string
  base_url?: string
  default_mode?: ExecutionMode
  default_permission?: PermissionMode
  summon_hotkey?: string
}

export interface PendingApproval {
  action: string
  params: Record<string, unknown>
  code_snippet?: string
  context?: string
  requested_at?: number
  action_type?: string
  details?: Record<string, unknown>
  description?: string
}

export interface SessionTargetInfo {
  target_id: string
  title: string
  target_type?: TargetType
  rect: Rect
}

export interface SessionSummary {
  session_id: string
  target_id: string
  title: string
  target_title?: string
  mode: ExecutionMode
  permission_mode: PermissionMode
  state: SessionState
  turn_count: number
  total_steps: number
  created_at?: number
}

export interface SessionDetail {
  session_id: string
  title?: string
  target: SessionTargetInfo
  targets?: SessionTargetInfo[]
  mode: ExecutionMode
  permission_mode: PermissionMode
  state: SessionState
  turn_count: number
  total_steps: number
  pending_approval: PendingApproval | null
}

export type SessionEventType =
  | 'session_start'
  | 'turn_start'
  | 'observe'
  | 'reasoning'
  | 'reasoning_delta'
  | 'message'
  | 'talk'
  | 'talk_delta'
  | 'content_delta'
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

export interface StreamingTextState {
  reasoning: string
  talk: string
  step: number
}

export interface HealthResponse {
  status: string
  version: string
  active_sessions: number
}

export interface CreateSessionRequest {
  target_id?: string
  target_ids?: string[]
  region?: RegionSpec
  cdp_ws_url?: string
  mode?: ExecutionMode
  permission_mode?: PermissionMode
  session_id?: string
}

export interface SendMessageRequest {
  instruction: string
  max_steps?: number
  async_execution?: boolean
}

export interface SubmitApprovalRequest {
  approved: boolean
  reason?: string
}

export interface ActionMarker {
  id: string
  x: number
  y: number
  action: string
  timestamp: number
}

export interface ExportSessionResponse {
  session_id: string
  format: 'python' | 'yaml' | 'markdown'
  content: string
  step_count: number
  workflow: Record<string, unknown>
}

export interface RunWorkflowRequest {
  workflow_yaml?: string
  session_id?: string
  target_id?: string
  dry_run?: boolean
  step_delay?: number
}

export interface RunWorkflowResponse {
  status: string
  steps?: number
  steps_executed?: number
  total_steps?: number
  elapsed_seconds?: number
  error?: string | null
  workflow?: Record<string, unknown>
}
