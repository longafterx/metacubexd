import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useHubHistory } from '../../composables/useHubHistory'
import {
  HubAPIError,
  hubEndpoint,
  hubErrorKey,
  hubRequest,
  hubWindow,
} from '../hub'
import { getHubHistory, hubTrend } from '../hubAnalytics'

beforeEach(() => vi.restoreAllMocks())
describe('hub 平台适配', () => {
  it('保留 API 错误代码与状态供管理页提供明确反馈', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: null,
            error: {
              code: 'instance_conflict',
              message: 'instance name already exists',
            },
          }),
          { status: 409 },
        ),
      ),
    )
    await expect(hubRequest('/api/v1/instances')).rejects.toMatchObject({
      code: 'instance_conflict',
      status: 409,
    })
    expect(
      hubErrorKey(new HubAPIError('instance_conflict', 'conflict', 409)),
    ).toBe('hub.errors.conflict')
    expect(hubErrorKey(new TypeError('Failed to fetch'))).toBe(
      'hub.errors.network',
    )
  })
  it('endpoint 只使用同源 Gateway，不携带密钥', () => {
    const item = {
      id: 'abc',
      name: 'test',
      gateway_url: '/mihomo/abc',
      has_secret: true,
    } as any
    expect(hubEndpoint(item, 'https://hub.test')).toEqual({
      id: 'abc',
      label: 'test',
      url: 'https://hub.test/mihomo/abc',
      secret: '',
    })
    expect(() =>
      hubEndpoint(
        { ...item, gateway_url: 'https://evil.test' },
        'https://hub.test',
      ),
    ).toThrow()
  })
  it('按 UTC 对齐，自动选择粒度并限制窗口', () => {
    const end = Date.parse('2026-11-06T10:23:45Z')
    expect(hubWindow(end - 3600000, end)).toMatchObject({
      from: '2026-11-06T09:23:00.000Z',
      to: '2026-11-06T10:23:00.000Z',
      step: '1m',
    })
    expect(hubWindow(end - 7 * 86400000, end).step).toBe('1h')
    expect(hubWindow(end - 90 * 86400000, end).step).toBe('1d')
    expect(() => hubWindow(end, end)).toThrow()
    expect(() => hubWindow(end - 367 * 86400000, end)).toThrow()
  })
  it('变更请求携带 Session 和 CSRF，读请求不缓存', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { csrf_token: 'test-csrf' }, error: null }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {}, error: null })),
      )
    vi.stubGlobal('fetch', fetch)
    await hubRequest('/api/v1/instances', {
      method: 'POST',
      body: { name: 'test' },
    })
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'same-origin',
      cache: 'no-store',
    })
    expect(fetch.mock.calls[1]?.[1].headers).toMatchObject({
      'X-CSRF-Token': 'test-csrf',
    })
    await expect(hubRequest('https://evil.test')).rejects.toThrow()
  })
  it('所有历史 API 共享窗口和实例过滤，连接查询有 31 天上限', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: [], meta: {}, error: null })),
      )
    vi.stubGlobal('fetch', fetch)
    const result = await getHubHistory({
      instance: 'all',
      from: 0,
      to: 90 * 86400000,
      dimension: 'process',
    })
    expect(result.connectionsAvailable).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(4)
    for (const [url] of fetch.mock.calls) {
      const parsed = new URL(url, 'https://hub.test')
      expect(parsed.searchParams.get('instance_ids')).toBe('all')
      expect(parsed.searchParams.get('step')).toBe('1d')
    }
  })
  it('没有观测的时间桶保留 null，不伪造零流量', () => {
    const points = hubTrend({
      window: { start: 0, end: 120000, step: '1m' },
      traffic: {
        data: [
          {
            bucket_ms: 0,
            observed_ms: 1000,
            total_upload: 2,
            total_download: 3,
          },
        ],
      },
    } as any)
    expect(points).toEqual([
      { timestamp: 0, upload: 2, download: 3 },
      { timestamp: 60000, upload: null, download: null },
    ])
  })
  it('切换实例立即清空，并拒绝已取消请求的迟到响应', async () => {
    const resolvers: ((value: any) => void)[] = []
    const signals: AbortSignal[] = []
    const loader = vi.fn((_query, signal) => {
      signals.push(signal)
      return new Promise<any>((resolve) => resolvers.push(resolve))
    })
    const scope = effectScope()
    const state = scope.run(() => useHubHistory(loader))!
    const query = {
      instance: 'a',
      from: 0,
      to: 60000,
      dimension: 'host' as const,
    }
    const a = state.load(query)
    const b = state.load({ ...query, instance: 'b' })
    expect(signals[0]?.aborted).toBe(true)
    expect(state.data.value).toBeNull()
    resolvers[1]!({ instance: 'b' })
    await b
    resolvers[0]!({ instance: 'a' })
    await a
    expect(state.data.value).toEqual({ instance: 'b' })
    state.clear()
    expect(state.data.value).toBeNull()
    scope.stop()
    expect(signals[1]?.aborted).toBe(true)
  })
})
