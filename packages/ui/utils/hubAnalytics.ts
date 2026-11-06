import type { HubConnection, HubGap, HubPoint, HubTop, HubTotals } from './hub'
import { hubRequest, hubWindow } from './hub'

export type HubDimension = 'host' | 'proxy' | 'rule' | 'process' | 'src_ip'
export interface HubHistoryQuery {
  instance: string
  from: number
  to: number
  dimension: HubDimension
  connectionOffset?: number
  gapOffset?: number
}
export async function getHubHistory(
  query: HubHistoryQuery,
  signal?: AbortSignal,
) {
  const window = hubWindow(query.from, query.to)
  const params = new URLSearchParams({
    instance_ids: query.instance,
    from: window.from,
    to: window.to,
    step: window.step,
  })
  const load = <T>(kind: string, extra: Record<string, string> = {}) => {
    const search = new URLSearchParams(params)
    Object.entries(extra).forEach(([key, value]) => search.set(key, value))
    return hubRequest<T>(`/api/v1/analytics/${kind}?${search}`, { signal })
  }
  const connectionsAvailable = window.end - window.start <= 31 * 86400000
  const [summary, traffic, top, gaps, connections] = await Promise.all([
    load<HubTotals>('summary'),
    load<HubPoint[]>('traffic'),
    load<HubTop[]>('top', { dimension: query.dimension, limit: '20' }),
    load<HubGap[]>('gaps', {
      limit: '50',
      offset: String(query.gapOffset || 0),
    }),
    connectionsAvailable
      ? load<HubConnection[]>('connections', {
          limit: '50',
          offset: String(query.connectionOffset || 0),
        })
      : Promise.resolve(null),
  ])
  return {
    window,
    summary,
    traffic,
    top,
    gaps,
    connections,
    connectionsAvailable,
  }
}
export type HubHistory = Awaited<ReturnType<typeof getHubHistory>>

/** 无采样的时间桶代表未知，不能伪造零流量。 */
export function hubTrend(history: Pick<HubHistory, 'window' | 'traffic'>) {
  const { window, traffic } = history
  const points = new Map(traffic.data.map((point) => [point.bucket_ms, point]))
  const step =
    window.step === '1m' ? 60000 : window.step === '1h' ? 3600000 : 86400000
  const result: {
    timestamp: number
    upload: number | null
    download: number | null
  }[] = []
  // 日桶固定为 UTC 自然日；窗口可能从当天的中途开始。
  for (
    let at = Math.floor(window.start / step) * step;
    at < window.end;
    at += step
  ) {
    const point = points.get(at)
    const observed = point && point.observed_ms > 0
    result.push({
      timestamp: at,
      upload: observed ? point.total_upload : null,
      download: observed ? point.total_download : null,
    })
  }
  return result
}
