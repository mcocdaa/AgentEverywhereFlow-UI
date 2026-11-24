import type {
  AppConfigResponse,
  CdpTargetInfo,
  CdpTargetsResponse,
  CreateSessionRequest,
  ExportSessionResponse,
  HealthResponse,
  PatchConfigRequest,
  PendingApproval,
  PermissionMode,
  Rect,
  RunWorkflowRequest,
  RunWorkflowResponse,
  SendMessageRequest,
  SessionDetail,
  SessionSummary,
  SubmitApprovalRequest,
  TargetInfo,
} from './types'

const DEFAULT_BASE_URL =
  typeof window !== 'undefined'
    ? '' // In browser (direct serve on any port, or vite dev proxy), use current host
    : 'http://127.0.0.1:8000'

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = localStorage.getItem('aef_api_base') || DEFAULT_BASE_URL
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '')
    localStorage.setItem('aef_api_base', this.baseUrl)
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }

    const response = await fetch(url, { ...options, headers })
    if (!response.ok) {
      let errorMsg = `HTTP ${response.status} ${response.statusText}`
      try {
        const errJson = await response.json()
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail)
        }
      } catch {
        // use status text
      }
      throw new Error(errorMsg)
    }

    return response.json() as Promise<T>
  }

  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/v1/health')
  }

  async listTargets(displaysOnly = false, windowsOnly = false): Promise<TargetInfo[]> {
    const params = new URLSearchParams()
    if (displaysOnly) params.append('displays_only', 'true')
    if (windowsOnly) params.append('windows_only', 'true')
    const qs = params.toString() ? `?${params.toString()}` : ''
    return this.request<TargetInfo[]>(`/api/v1/targets${qs}`)
  }

  getTargetThumbnailUrl(targetId: string, width = 360, cacheBust?: number): string {
    const base = this.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    const suffix = cacheBust ? `&t=${cacheBust}` : ''
    return `${base}/api/v1/targets/${encodeURIComponent(targetId)}/thumbnail?width=${width}${suffix}`
  }

  async listCdpTargets(endpoint?: string): Promise<CdpTargetsResponse> {
    const params = new URLSearchParams()
    if (endpoint && endpoint.trim()) {
      params.append('endpoint', endpoint.trim())
    }
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await this.request<CdpTargetsResponse | CdpTargetInfo[]>(`/api/v1/targets/cdp${qs}`)
    const fallbackEndpoint = endpoint?.trim() || 'http://127.0.0.1:9222'
    if (Array.isArray(res)) {
      return { endpoint: fallbackEndpoint, targets: res }
    }
    return {
      endpoint: res.endpoint || fallbackEndpoint,
      targets: Array.isArray(res.targets) ? res.targets : [],
    }
  }

  async getConfig(): Promise<AppConfigResponse> {
    return this.request<AppConfigResponse>('/api/v1/config')
  }

  async patchConfig(payload: PatchConfigRequest): Promise<AppConfigResponse> {
    return this.request<AppConfigResponse>('/api/v1/config', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.request<SessionSummary[]>('/api/v1/sessions')
  }

  async createSession(req: CreateSessionRequest): Promise<SessionDetail> {
    return this.request<SessionDetail>('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  }

  async getSession(sessionId: string): Promise<SessionDetail> {
    return this.request<SessionDetail>(`/api/v1/sessions/${encodeURIComponent(sessionId)}`)
  }

  async getSessionHistory(sessionId: string): Promise<{
    session_id: string
    events: import('./types').SessionEvent[]
    recorded_steps: Record<string, unknown>[]
    turn_count: number
    total_steps: number
  }> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/history`)
  }

  async sendMessage(sessionId: string, req: SendMessageRequest): Promise<unknown> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/message`, {
      method: 'POST',
      body: JSON.stringify(req),
    })
  }

  async getPendingApproval(sessionId: string): Promise<PendingApproval | null> {
    return this.request<PendingApproval | null>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/approval`)
  }

  async submitApproval(sessionId: string, req: SubmitApprovalRequest): Promise<{ status: string; approved: boolean }> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/approval`, {
      method: 'POST',
      body: JSON.stringify(req),
    })
  }

  async updatePermission(sessionId: string, mode: PermissionMode): Promise<{ status: string; permission_mode: string }> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/permission`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    })
  }

  async switchTarget(
    sessionId: string,
    targetId: string
  ): Promise<{ status: string; target: { target_id: string; title: string; rect?: Rect } }> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/target`, {
      method: 'POST',
      body: JSON.stringify({ target_id: targetId }),
    })
  }

  async resetSession(sessionId: string): Promise<{ status: string; message: string }> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/reset`, {
      method: 'POST',
    })
  }

  async abortSession(sessionId: string): Promise<{ status: string; message: string }> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/abort`, {
      method: 'POST',
    })
  }

  async updateSession(
    sessionId: string,
    data: { title?: string }
  ): Promise<{ status: string; session_id: string; title: string }> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteSession(sessionId: string): Promise<{ status: string; message: string }> {
    return this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    })
  }

  async exportSession(
    sessionId: string,
    format: 'python' | 'yaml' | 'markdown',
    workflowName?: string
  ): Promise<ExportSessionResponse> {
    const params = new URLSearchParams({ format })
    if (workflowName) {
      params.append('workflow_name', workflowName)
    }
    return this.request<ExportSessionResponse>(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/export?${params.toString()}`
    )
  }

  async runWorkflow(params: RunWorkflowRequest): Promise<RunWorkflowResponse> {
    return this.request<RunWorkflowResponse>('/api/v1/workflows/run', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  getScreenshotUrl(sessionId: string): string {
    const base = this.baseUrl || window.location.origin
    return `${base}/api/v1/sessions/${encodeURIComponent(sessionId)}/screenshot?t=${Date.now()}`
  }

  getWebSocketUrl(sessionId: string): string {
    let wsHost = this.baseUrl
    if (!wsHost) {
      const loc = window.location
      const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${proto}//${loc.host}/api/v1/sessions/${encodeURIComponent(sessionId)}/ws`
    }
    wsHost = wsHost.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
    return `${wsHost}/api/v1/sessions/${encodeURIComponent(sessionId)}/ws`
  }
}

export const api = new ApiClient()
