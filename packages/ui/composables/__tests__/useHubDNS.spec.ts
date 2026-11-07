import { describe, expect, it, vi } from 'vitest'
import { HubAPIError } from '~/utils/hub'
import { useHubDNS } from '../useHubDNS'

const snapshot = (imported = true, revision = 1) => ({
  imported,
  revision,
  updated_at_ms: 1000,
  dns: {
    enable: true,
    listen: '127.0.0.1:1053',
    'enhanced-mode': 'fake-ip',
    nameserver: ['1.1.1.1'],
    fallback: [],
    'fake-ip-range': '',
    'use-hosts': true,
  },
})

describe('hub DNS 完整配置流程', () => {
  it('未读取版本或未导入时不能应用；导入只保存，不发起热加载', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: snapshot(false, 0) })
      .mockResolvedValueOnce({ data: snapshot() })
    const state = useHubDNS('a', request)
    expect(await state.importYAML('rules: []')).toBe(false)
    await state.load()
    expect(await state.apply()).toBe(false)
    expect(await state.importYAML('rules: []')).toBe(true)
    expect(request).toHaveBeenLastCalledWith(
      '/api/v1/instances/a/runtime-config',
      { method: 'PUT', body: { yaml: 'rules: []', revision: 0 } },
    )
    expect(
      request.mock.calls.some(([, options]) => options?.method === 'PATCH'),
    ).toBe(false)
  })
  it('提交当前修订和 DNS 字段，并从成功响应更新表单', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: snapshot() })
      .mockResolvedValueOnce({
        data: {
          ...snapshot(true, 2),
          dns: { ...snapshot().dns, nameserver: ['8.8.8.8'] },
        },
      })
    const state = useHubDNS('a', request)
    await state.load()
    state.form.nameserver = ' 8.8.8.8 \n\n'
    expect(await state.apply()).toBe(true)
    expect(request).toHaveBeenLastCalledWith(
      '/api/v1/instances/a/runtime-config/dns',
      {
        method: 'PATCH',
        body: {
          revision: 1,
          dns: { ...snapshot().dns, nameserver: ['8.8.8.8'] },
        },
      },
    )
    expect(state.view.value?.revision).toBe(2)
    expect(state.form.nameserver).toBe('8.8.8.8')
  })
  it('冲突和失败保留编辑内容，不报告保存成功或自动重试', async () => {
    const error = new HubAPIError('runtime_config_conflict', 'changed', 409)
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: snapshot() })
      .mockRejectedValueOnce(error)
    const state = useHubDNS('a', request)
    await state.load()
    state.form.nameserver = '8.8.8.8'
    expect(await state.apply()).toBe(false)
    expect(state.error.value).toBe(error)
    expect(state.form.nameserver).toBe('8.8.8.8')
    expect(state.view.value?.revision).toBe(1)
    expect(request).toHaveBeenCalledTimes(2)
  })
  it('实例表单彼此隔离，并阻止重复提交', async () => {
    let finish!: (value: unknown) => void
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: snapshot() })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
    const a = useHubDNS('a', request)
    const b = useHubDNS('b', request)
    await a.load()
    const pending = a.apply()
    expect(a.busy.value).toBe(true)
    expect(await a.apply()).toBe(false)
    expect(b.view.value).toBeNull()
    finish({ data: snapshot(true, 2) })
    await pending
    expect(a.busy.value).toBe(false)
    expect(b.view.value).toBeNull()
  })
})
