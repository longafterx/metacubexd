import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useEndpointStore } from '../endpoint'

const instances = ref<any[]>([])
beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { mihomoHub: true } }))
  vi.stubGlobal('useHubStore', () => ({
    get instances() {
      return instances.value
    },
  }))
  instances.value = [
    { id: 'one', name: 'first', enabled: true, gateway_url: '/mihomo/one' },
  ]
})
describe('hub endpoint identity', () => {
  it('健康状态轮询保留对象身份，实例切换仍独立', () => {
    const store = useEndpointStore()
    store.setSelectedEndpoint('one')
    const first = store.currentEndpoint
    instances.value = [{ ...instances.value[0], collector_status: 'online' }]
    expect(store.currentEndpoint).toBe(first)
    instances.value = [
      ...instances.value,
      { id: 'two', name: 'second', enabled: true, gateway_url: '/mihomo/two' },
    ]
    store.setSelectedEndpoint('two')
    expect(store.currentEndpoint?.id).toBe('two')
    expect(store.currentEndpoint?.secret).toBe('')
    expect(localStorage.getItem('endpointList')).toBeNull()
  })
})
