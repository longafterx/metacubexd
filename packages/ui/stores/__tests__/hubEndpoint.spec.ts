import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useEndpointStore } from '../endpoint'

const instances = ref<any[]>([])
const loaded = ref(true)
beforeEach(() => {
  loaded.value = true
  setActivePinia(createPinia())
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { mihomoHub: true } }))
  vi.stubGlobal('useHubStore', () => ({
    get instances() {
      return instances.value
    },
    get loaded() {
      return loaded.value
    },
  }))
  instances.value = [
    { id: 'one', name: 'first', enabled: true, gateway_url: '/mihomo/one' },
  ]
})
describe('hub endpoint identity', () => {
  it('目录加载前保留上次选择，加载后仍查看原实例', async () => {
    loaded.value = false
    instances.value = []
    localStorage.setItem('selectedEndpoint', 'two')
    const store = useEndpointStore()
    expect(store.selectedEndpoint).toBe('two')
    instances.value = ['one', 'two'].map((id) => ({
      id,
      name: id,
      enabled: true,
      gateway_url: `/mihomo/${id}`,
    }))
    loaded.value = true
    await nextTick()
    expect(store.currentEndpoint?.id).toBe('two')
    instances.value = []
    await nextTick()
    expect(store.selectedEndpoint).toBe('')
  })
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

it('切换只改变当前视图，其他实例继续管理和采集，删除当前实例后自动回退', async () => {
  instances.value = ['one', 'two'].map((id) => ({
    id,
    name: id,
    gateway_url: `/mihomo/${id}`,
    enabled: true,
    collect_enabled: true,
    collector_status: 'online',
  }))
  const store = useEndpointStore()
  store.setSelectedEndpoint('one')
  const before = JSON.stringify(instances.value)
  store.setSelectedEndpoint('two')
  expect(store.currentEndpoint?.id).toBe('two')
  expect(JSON.stringify(instances.value)).toBe(before)
  expect(store.endpointList.map((item) => item.id)).toEqual(['one', 'two'])
  instances.value = [instances.value[0]]
  await nextTick()
  expect(store.selectedEndpoint).toBe('one')
})
