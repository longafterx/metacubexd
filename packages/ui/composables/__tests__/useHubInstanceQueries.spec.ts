import { QueryClient } from '@tanstack/vue-query'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'
import { useHubInstanceQueries } from '../useHubInstanceQueries'

const state = vi.hoisted(() => ({ client: null as QueryClient | null }))
vi.mock('@tanstack/vue-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/vue-query')>()),
  useQueryClient: () => state.client,
}))

describe('实例切换时的查询缓存', () => {
  it('同步清除目标实例快照，保留其他实例与无关查询', () => {
    const endpoint = reactive({ selectedEndpoint: 'one' })
    vi.stubGlobal('useEndpointStore', () => endpoint)
    const client = new QueryClient()
    state.client = client
    for (const id of ['one', 'two']) {
      client.setQueryData(['config', id], { port: 7890 })
      client.setQueryData(['version', id], 'v1.19.21')
    }
    client.setQueryData(['unrelated', 'two'], 'preserved')
    const scope = effectScope()
    scope.run(useHubInstanceQueries)
    endpoint.selectedEndpoint = 'two'
    expect(client.getQueryData(['config', 'two'])).toBeUndefined()
    expect(client.getQueryData(['version', 'two'])).toBeUndefined()
    expect(client.getQueryData(['config', 'one'])).toEqual({ port: 7890 })
    expect(client.getQueryData(['unrelated', 'two'])).toBe('preserved')
    endpoint.selectedEndpoint = 'one'
    expect(client.getQueryData(['config', 'one'])).toBeUndefined()
    scope.stop()
    client.clear()
  })
})
