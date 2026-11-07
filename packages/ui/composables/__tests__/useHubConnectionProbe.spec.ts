import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useHubConnectionProbe } from '../useHubConnectionProbe'

const result = {
  data: { reachable: true, version: 'v1.19.21', latency_ms: 7 },
} as any
afterEach(() => vi.useRealTimers())

describe('实例连接延迟', () => {
  it.each([undefined, -1, Number.NaN])(
    '无效延迟 %s 不能显示连接成功',
    async (latency_ms) => {
      const request = vi
        .fn()
        .mockResolvedValue({ data: { ...result.data, latency_ms } })
      const scope = effectScope()
      const state = scope.run(() => useHubConnectionProbe('one', request))!
      await state.probe()
      expect(state.result.value).toBeNull()
      expect(state.error.value).toBeInstanceOf(Error)
      scope.stop()
    },
  )
  it('悬浮前不请求，重复悬浮合并请求并短期复用服务端延迟', async () => {
    vi.useFakeTimers()
    let finish!: (value: any) => void
    const request = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const scope = effectScope()
    const state = scope.run(() => useHubConnectionProbe('one', request))!
    expect(request).not.toHaveBeenCalled()
    const first = state.probe()
    const second = state.probe()
    expect(request).toHaveBeenCalledOnce()
    finish(result)
    await Promise.all([first, second])
    expect(state.result.value?.latency_ms).toBe(7)
    await state.probe()
    expect(request).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30_001)
    request.mockResolvedValueOnce(result)
    await state.probe()
    expect(request).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('实例之间不复用延迟，错误不显示为零延迟或成功', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(result)
      .mockRejectedValueOnce(new Error('offline'))
    const scope = effectScope()
    const [one, two] = scope.run(() => [
      useHubConnectionProbe('one', request),
      useHubConnectionProbe('two', request),
    ])!
    await one!.probe()
    await two!.probe()
    expect(one!.result.value?.latency_ms).toBe(7)
    expect(two!.result.value).toBeNull()
    expect(two!.error.value).toBeInstanceOf(Error)
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/instances/one/test',
      '/api/v1/instances/two/test',
    ])
    scope.stop()
  })

  it('卸载取消读取，忽略不遵守取消的迟到响应', async () => {
    let finish!: (value: any) => void
    const request = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const scope = effectScope()
    const state = scope.run(() => useHubConnectionProbe('one', request))!
    const pending = state.probe()
    scope.stop()
    expect(request.mock.calls[0]?.[1].signal.aborted).toBe(true)
    finish(result)
    await pending
    expect(state.result.value).toBeNull()
    expect(state.error.value).toBeNull()
    expect(state.loading.value).toBe(false)
  })
})
