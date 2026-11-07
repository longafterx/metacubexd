import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  updateProxyProviderAPI,
  updateRuleProviderAPI,
  useConfigActions,
  useRequest,
} from '../useApi'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('ky', () => ({ default: { create: mocks.create, get: vi.fn() } }))
vi.mock('vue-sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}))
vi.stubGlobal('useEndpointStore', () => ({
  currentEndpoint: { url: 'http://localhost/mihomo/a', secret: '' },
}))

describe('controller 维护操作', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockReturnValue({ put: mocks.put, post: mocks.post })
    mocks.put.mockResolvedValue(undefined)
    mocks.post.mockResolvedValue(undefined)
  })
  it.each([
    ['reloadConfigFileAPI', 'put', 'configs'],
    ['restartBackendAPI', 'post', 'restart'],
    ['flushDNSCacheAPI', 'post', 'cache/dns/flush'],
    ['flushFakeIPDataAPI', 'post', 'cache/fakeip/flush'],
    ['updateGEODatabasesAPI', 'post', 'configs/geo'],
  ] as const)(
    '%s 发送原生请求，使用维护超时且不重试',
    async (action, method, path) => {
      expect(await useConfigActions()[action]()).toBe(true)
      expect(mocks[method]).toHaveBeenCalledWith(
        path,
        expect.objectContaining({ timeout: 610000, retry: 0 }),
      )
      expect(mocks.success).toHaveBeenCalledOnce()
      expect(mocks.error).not.toHaveBeenCalled()
    },
  )
  it('失败明确提示且返回 false，清除加载状态', async () => {
    mocks.post.mockRejectedValue({ response: { status: 403 } })
    const actions = useConfigActions()
    expect(await actions.restartBackendAPI()).toBe(false)
    expect(actions.restartingBackend.value).toBe(false)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('hub.control.failed', {
      description: 'hub.control.forbidden',
    })
    expect(mocks.post).toHaveBeenCalledOnce()
  })
  it('provider 名称按一个路径段编码，更新不自动重试', async () => {
    await updateProxyProviderAPI('中文/provider')
    await updateRuleProviderAPI('规则/provider')
    for (const [path, options] of mocks.put.mock.calls) {
      expect(path).toContain('%2Fprovider')
      expect(options).toEqual({ timeout: 610000, retry: 0 })
    }
  })
  it('默认客户端只为读取操作保留重试', () => {
    useRequest()
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ retry: { methods: ['get'] } }),
    )
  })
})
