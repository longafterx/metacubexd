import type { HubInstance } from '~/utils/hub'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hubRequest } from '~/utils/hub'
import { useHubStore } from '../hub'

vi.mock('~/utils/hub', () => ({ hubRequest: vi.fn() }))
const request = vi.mocked(hubRequest)
const item = {
  id: 'new-id',
  name: 'hugo-ecs',
  gateway_url: '/mihomo/new-id',
  has_secret: false,
  enabled: true,
  collect_enabled: true,
  collector_status: 'connecting',
  last_seen_at_ms: null,
} satisfies HubInstance
const envelope = (data: unknown) => ({ data, error: null, meta: {} }) as any

beforeEach(() => {
  setActivePinia(createPinia())
  request.mockReset()
})

describe('实例变更与轮询的边界', () => {
  it('新增已提交时，列表读取失败不能变成新增失败', async () => {
    const store = useHubStore()
    request.mockImplementation(async (_url, options) => {
      if (options?.method === 'POST') return envelope(item)
      throw new Error('list unavailable')
    })
    await expect(
      store.save(null, { name: item.name, secret: '' }),
    ).resolves.toBeUndefined()
    expect(store.instances).toEqual([item])
    await expect(store.refresh(true)).rejects.toThrow('list unavailable')
    expect(store.instances).toEqual([item])
  })

  it('变更前发出的慢轮询不能覆盖新增结果', async () => {
    const store = useHubStore()
    let finish!: (value: any) => void
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const poll = store.refresh(true)
    request.mockResolvedValueOnce(envelope(item))
    const save = store.save(null, { name: item.name })
    await Promise.resolve()
    finish(envelope([]))
    await Promise.all([poll, save])
    expect(store.instances).toEqual([item])
  })

  it('删除已提交时，慢轮询不能重新显示已删除实例', async () => {
    const store = useHubStore()
    store.instances = [item]
    let finish!: (value: any) => void
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const poll = store.refresh(true)
    request.mockResolvedValueOnce(envelope({ deleted: true }))
    const remove = store.remove(item.id, 'retain')
    await Promise.resolve()
    finish(envelope([item]))
    await Promise.all([poll, remove])
    expect(store.instances).toEqual([])
  })

  it('真正的写入失败保留现有列表并向调用方报错', async () => {
    const store = useHubStore()
    store.instances = [item]
    request.mockRejectedValueOnce(new Error('instance name already exists'))
    await expect(store.save(null, { name: item.name })).rejects.toThrow(
      'already exists',
    )
    expect(store.instances).toEqual([item])
  })

  it('编辑使用响应替换原实例，后续健康轮询仍可更新状态', async () => {
    const store = useHubStore()
    const second = { ...item, id: 'second', name: 'second' }
    store.instances = [item, second]
    request.mockResolvedValueOnce(envelope({ ...item, name: 'renamed' }))
    await store.save(item.id, { name: 'renamed' })
    expect(store.instances.map((item) => item.name)).toEqual([
      'renamed',
      'second',
    ])
    const online = { ...store.instances[0], collector_status: 'online' }
    request.mockResolvedValueOnce(envelope([online, second]))
    await store.refresh(true)
    expect(store.instances[0]?.collector_status).toBe('online')
  })

  it('过期轮询的错误不再污染变更后的状态', async () => {
    const store = useHubStore()
    let reject!: (error: Error) => void
    request.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail
      }),
    )
    const poll = store.refresh(true)
    request.mockResolvedValueOnce(envelope(item))
    await store.save(null, { name: item.name })
    reject(new Error('old poll failed'))
    await expect(poll).resolves.toBeUndefined()
    expect(store.error).toBe('')
    expect(store.instances).toEqual([item])
  })
})
