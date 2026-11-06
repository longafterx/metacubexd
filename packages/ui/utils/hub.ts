/** 平台请求与原生 Gateway 分离；真实 Controller 密钥不得进入 Endpoint。 */
export interface HubInstance {
  id: string
  name: string
  gateway_url: string
  has_secret: boolean
  enabled: boolean
  collect_enabled: boolean
  collector_status: string
  last_seen_at_ms: number | null
}
export interface HubCoverage {
  instance_id: string
  name: string
  deleted: boolean
  observed_ms: number
  window_ms: number
  sample_coverage: number
  first_retained_minute_ms: number | null
  first_retained_hour_ms: number | null
  last_snapshot_at_ms: number | null
  has_gap: boolean
}
export interface HubMeta {
  source: string
  metric_definition: string
  has_gap: boolean
  gap_count: number
  coverage: HubCoverage[]
}
export interface HubEnvelope<T> {
  data: T
  meta: HubMeta
  error: null
}
export interface HubTotals {
  total_upload: number
  total_download: number
  attributed_upload: number
  attributed_download: number
  unattributed_upload: number | null
  unattributed_download: number | null
  consistent: boolean
}
export interface HubPoint extends HubTotals {
  bucket_ms: number
  observed_ms: number
  has_gap: boolean
}
export interface HubTop {
  value: string
  upload_bytes: number
  download_bytes: number
}
export interface HubGap {
  id: string
  instance_id: string
  from_ms: number
  to_ms: number | null
  reason: string
  resolution: string
  candidate_upload_bytes: number | null
  candidate_download_bytes: number | null
}
export interface HubConnection {
  instance_id: string
  lifecycle_id: string
  host: string
  proxy: string
  last_seen_at_ms: number
  closed_at_ms: number | null
  lifetime_upload_bytes: number
  lifetime_download_bytes: number
}
let csrf = ''
let redirecting = false
export class HubAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'HubAPIError'
  }
}

export function hubErrorKey(error: unknown) {
  if (!(error instanceof HubAPIError)) return 'hub.errors.network'
  const codes: Record<string, string> = {
    instance_conflict: 'conflict',
    invalid_instance: 'invalid',
    instance_not_found: 'notFound',
    controller_unavailable: 'controller',
    csrf_failed: 'csrf',
    rate_limited: 'rateLimit',
    unauthorized: 'session',
    storage_error: 'storage',
  }
  return `hub.errors.${codes[error.code] || 'request'}`
}
export async function hubRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<HubEnvelope<T>> {
  if (!path.startsWith('/api/v1/')) throw new Error('Invalid platform path')
  const method = options.method || 'GET'
  if (method !== 'GET' && !csrf) {
    const me = await hubRequest<{ csrf_token: string }>('/api/v1/auth/me')
    csrf = me.data.csrf_token
  }
  const response = await fetch(path, {
    method,
    signal: options.signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(method === 'GET' ? {} : { 'X-CSRF-Token': csrf }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (response.status === 401) {
    csrf = ''
    // 多个并发请求可能同时返回 401，只发起一次整页导航。
    if (typeof window !== 'undefined' && !redirecting) {
      redirecting = true
      window.location.replace('/login')
    }
    throw new HubAPIError('unauthorized', 'Session expired', 401)
  }
  const result = await response.json()
  if (!response.ok || result.error)
    throw new HubAPIError(
      result.error?.code || 'request_failed',
      result.error?.message || 'Request failed',
      response.status,
    )
  return result
}
export function hubEndpoint(instance: HubInstance, origin: string) {
  // A compromised/misconfigured response cannot turn the dashboard into a
  // browser-side arbitrary Controller client.
  if (instance.gateway_url !== `/mihomo/${instance.id}`)
    throw new Error('Invalid gateway path')
  return {
    id: instance.id,
    url: origin + instance.gateway_url,
    secret: '',
    label: instance.name,
  }
}
export function hubWindow(from: number, to: number) {
  const duration = to - from
  if (!Number.isFinite(duration) || duration <= 0 || duration > 366 * 86400000)
    throw new Error('Invalid time window')
  const step =
    duration <= 86400000 ? '1m' : duration <= 60 * 86400000 ? '1h' : '1d'
  const alignment = step === '1m' ? 60000 : 3600000
  const end = Math.floor(to / alignment) * alignment
  const start = Math.floor(from / alignment) * alignment
  if (end <= start) throw new Error('Choose at least one complete time bucket')
  return {
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
    step,
    start,
    end,
  }
}
