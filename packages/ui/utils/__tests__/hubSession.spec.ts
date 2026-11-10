import { beforeEach, describe, expect, it, vi } from 'vitest'

const envelope = (data: unknown, status = 200, code?: string) =>
  new Response(
    JSON.stringify({
      data,
      meta: {},
      error: code ? { code, message: code } : null,
    }),
    { status },
  )

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('跨标签页会话更新', () => {
  it('旧 CSRF 被明确拒绝时刷新令牌，并且只重发一次', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(envelope({ csrf_token: 'old' }))
      .mockResolvedValueOnce(envelope({}))
      .mockResolvedValueOnce(envelope(null, 403, 'csrf_failed'))
      .mockResolvedValueOnce(envelope({ csrf_token: 'new' }))
      .mockResolvedValueOnce(envelope({ saved: true }))
    vi.stubGlobal('fetch', fetch)
    const { hubRequest } = await import('../hub')
    await hubRequest('/api/v1/instances', { method: 'POST' })
    await expect(
      hubRequest('/api/v1/instances/a', {
        method: 'PATCH',
        body: { name: 'new' },
      }),
    ).resolves.toMatchObject({ data: { saved: true } })
    expect(fetch).toHaveBeenCalledTimes(5)
    expect(fetch.mock.calls[4]?.[1].headers['X-CSRF-Token']).toBe('new')
    expect(fetch.mock.calls[4]?.[1].body).toBe(fetch.mock.calls[2]?.[1].body)
  })

  it.each([
    { name: '存储失败', status: 500, code: 'storage_error' },
    { name: '普通权限拒绝', status: 403, code: 'runtime_writes_disabled' },
  ])('$name 不自动重试变更', async ({ status, code }) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(envelope({ csrf_token: 'token' }))
      .mockResolvedValueOnce(envelope(null, status, code))
    vi.stubGlobal('fetch', fetch)
    const { hubRequest } = await import('../hub')
    await expect(
      hubRequest('/api/v1/instances/a', { method: 'DELETE' }),
    ).rejects.toMatchObject({ code })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('刷新后仍被拒绝时停止，避免无限重试', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(envelope({ csrf_token: 'old' }))
      .mockResolvedValueOnce(envelope(null, 403, 'csrf_failed'))
      .mockResolvedValueOnce(envelope({ csrf_token: 'new' }))
      .mockResolvedValueOnce(envelope(null, 403, 'csrf_failed'))
    vi.stubGlobal('fetch', fetch)
    const { hubRequest } = await import('../hub')
    await expect(
      hubRequest('/api/v1/instances/a', { method: 'DELETE' }),
    ).rejects.toMatchObject({ code: 'csrf_failed' })
    expect(fetch).toHaveBeenCalledTimes(4)
  })
})
