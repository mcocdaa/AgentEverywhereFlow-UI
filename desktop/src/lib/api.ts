import type {
  CdpTargetInfo,
  ConfigPatch,
  ConfigResponse,
  ExecutionMode,
  HealthResponse,
  PermissionMode,
  RegionSpec,
  SessionDetail,
  TargetInfo,
} from './types'

export const DEMO_TARGETS: TargetInfo[] = [
  {
    target_id: 'display:1',
    target_type: 'display',
    title: 'Primary Display 1',
    native_handle: 0,
    process_name: 'Display',
    is_minimized: false,
    rect: { x: 0, y: 0, width: 2560, height: 1440 },
  },
  {
    target_id: 'win:chrome-q4',
    target_type: 'window',
    title: 'Chrome — Q4 Revenue Dashboard',
    native_handle: 102401,
    process_name: 'chrome',
    is_minimized: false,
    rect: { x: 110, y: 84, width: 1440, height: 900 },
  },
  {
    target_id: 'win:vscode-aef',
    target_type: 'window',
    title: 'Visual Studio Code — AgentEverywhereFlow',
    native_handle: 102402,
    process_name: 'code',
    is_minimized: false,
    rect: { x: 240, y: 120, width: 1380, height: 860 },
  },
  {
    target_id: 'win:figma-spec',
    target_type: 'window',
    title: 'Figma — Desktop Companion Spec',
    native_handle: 102403,
    process_name: 'figma',
    is_minimized: false,
    rect: { x: 460, y: 140, width: 1280, height: 800 },
  },
  {
    target_id: 'win:notes',
    target_type: 'window',
    title: 'Notes — Weekly Sync',
    native_handle: 102404,
    process_name: 'notes',
    is_minimized: true,
    rect: { x: 180, y: 200, width: 920, height: 640 },
  },
]

export const DEMO_CDP_TARGETS: CdpTargetInfo[] = [
  {
    id: 'page-9222-1',
    target_id: 'cdp:page-9222-1',
    title: 'GitHub — AgentEverywhereFlow Pull Requests',
    url: 'https://github.com/mcocdaa/AgentEverywhereFlow/pulls',
    ws_url: 'ws://127.0.0.1:9222/devtools/page/page-9222-1',
  },
  {
    id: 'page-9222-2',
    target_id: 'cdp:page-9222-2',
    title: 'Linear — Active Sprint Board',
    url: 'https://linear.app/aeflow/board',
    ws_url: 'ws://127.0.0.1:9222/devtools/page/page-9222-2',
  },
]

class DesktopApiClient {
  private baseUrl: string | null = null

  setBaseUrl(url: string | null): void {
    this.baseUrl = url ? url.replace(/\/$/, '') : null
  }

  getBaseUrl(): string | null {
    return this.baseUrl
  }

  isLive(): boolean {
    return Boolean(this.baseUrl)
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('DAEMON_OFFLINE')
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    }
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const json = (await res.json()) as { detail?: unknown }
        if (typeof json.detail === 'string') detail = json.detail
      } catch {
        // ignore JSON parse failure
      }
      throw new Error(detail)
    }
    return res.json() as Promise<T>
  }

  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/v1/health')
  }

  async getConfig(): Promise<ConfigResponse> {
    if (!this.baseUrl) {
      return {
        model_name: 'gpt-4o',
        base_url: 'https://api.openai.com/v1',
        api_key_set: true,
        api_key_preview: 'sk-...demo',
        default_mode: 'minimal',
        default_permission: 'auto',
        summon_hotkey: 'Alt+Space',
      }
    }
    return this.request<ConfigResponse>('/api/v1/config')
  }

  async patchConfig(patch: ConfigPatch): Promise<ConfigResponse> {
    if (!this.baseUrl) {
      return {
        model_name: patch.model_name || 'gpt-4o',
        base_url: patch.base_url || 'https://api.openai.com/v1',
        api_key_set: Boolean(patch.api_key) || true,
        api_key_preview: patch.api_key ? `${patch.api_key.slice(0, 4)}...${patch.api_key.slice(-4)}` : 'sk-...demo',
        default_mode: patch.default_mode || 'minimal',
        default_permission: patch.default_permission || 'auto',
        summon_hotkey: patch.summon_hotkey || 'Alt+Space',
      }
    }
    return this.request<ConfigResponse>('/api/v1/config', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }

  async listTargets(): Promise<TargetInfo[]> {
    if (!this.baseUrl) return DEMO_TARGETS
    try {
      return await this.request<TargetInfo[]>('/api/v1/targets')
    } catch {
      return []
    }
  }

  async targetAtPoint(x: number, y: number, excludePid?: number | null): Promise<TargetInfo | null> {
    if (!this.baseUrl) {
      // Deterministic hit-test against preview mock cards
      const hit = DEMO_TARGETS.find(
        (t) =>
          t.target_type === 'window' &&
          !t.is_minimized &&
          x >= t.rect.x &&
          x <= t.rect.x + t.rect.width &&
          y >= t.rect.y &&
          y <= t.rect.y + t.rect.height,
      )
      return hit ?? DEMO_TARGETS[1]
    }
    const params = new URLSearchParams({
      x: String(Math.round(x)),
      y: String(Math.round(y)),
    })
    if (excludePid) params.set('exclude_pid', String(excludePid))
    const res = await this.request<{ target?: TargetInfo | null } | TargetInfo | null>(
      `/api/v1/targets/at-point?${params.toString()}`,
    )
    if (!res) return null
    if ('target' in res) return res.target ?? null
    if ('target_id' in res) return res
    return null
  }

  getThumbnailUrl(targetId: string, width = 360): string | null {
    if (!this.baseUrl) return null
    return `${this.baseUrl}/api/v1/targets/${encodeURIComponent(targetId)}/thumbnail?width=${width}&quality=70`
  }

  async listCdpTargets(endpoint = 'http://127.0.0.1:9222'): Promise<CdpTargetInfo[]> {
    if (!this.baseUrl) return DEMO_CDP_TARGETS
    try {
      const params = new URLSearchParams({ endpoint })
      const res = await this.request<{ targets?: CdpTargetInfo[] } | CdpTargetInfo[]>(
        `/api/v1/targets/cdp?${params.toString()}`,
      )
      if (Array.isArray(res)) return res
      return res.targets ?? []
    } catch {
      return []
    }
  }

  async createSession(req: {
    target_id: string
    target_ids?: string[]
    region?: RegionSpec
    cdp_ws_url?: string
    mode?: ExecutionMode
    permission_mode?: PermissionMode
  }): Promise<SessionDetail> {
    if (!this.baseUrl) {
      const target =
        DEMO_TARGETS.find((t) => t.target_id === req.target_id) ?? {
          target_id: req.target_id,
          title: req.region?.title || req.target_id,
          rect: req.region
            ? { x: req.region.x, y: req.region.y, width: req.region.width, height: req.region.height }
            : { x: 110, y: 84, width: 1440, height: 900 },
        }
      return {
        session_id: `preview-${Date.now().toString(36)}`,
        title: target.title,
        target: {
          target_id: target.target_id,
          title: target.title,
          rect: target.rect,
        },
        mode: req.mode ?? 'minimal',
        permission_mode: req.permission_mode ?? 'auto',
        state: 'idle',
      }
    }
    return this.request<SessionDetail>('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  }

  async sendMessage(sessionId: string, instruction: string, maxSteps = 50): Promise<void> {
    if (!this.baseUrl) return
    await this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/message`, {
      method: 'POST',
      body: JSON.stringify({ instruction, max_steps: maxSteps, async_execution: true }),
    })
  }

  async submitApproval(sessionId: string, approved: boolean, reason?: string): Promise<void> {
    if (!this.baseUrl) return
    await this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/approval`, {
      method: 'POST',
      body: JSON.stringify({ approved, reason }),
    })
  }

  async updatePermission(sessionId: string, mode: PermissionMode): Promise<void> {
    if (!this.baseUrl) return
    await this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/permission`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    })
  }

  async abortSession(sessionId: string): Promise<void> {
    if (!this.baseUrl) return
    await this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/abort`, {
      method: 'POST',
    })
  }

  async resetSession(sessionId: string): Promise<void> {
    if (!this.baseUrl) return
    await this.request(`/api/v1/sessions/${encodeURIComponent(sessionId)}/reset`, {
      method: 'POST',
    })
  }

  getSessionWsUrl(sessionId: string): string | null {
    if (!this.baseUrl) return null
    const wsBase = this.baseUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
    return `${wsBase}/api/v1/sessions/${encodeURIComponent(sessionId)}/ws`
  }

  getGlobalEventsWsUrl(): string | null {
    if (!this.baseUrl) return null
    const wsBase = this.baseUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://')
    return `${wsBase}/api/v1/events`
  }

  getStudioUrl(sessionId?: string | null): string {
    const base = this.baseUrl || 'http://127.0.0.1:8000'
    return sessionId ? `${base}/?session=${encodeURIComponent(sessionId)}` : `${base}/`
  }
}

export const desktopApi = new DesktopApiClient()
