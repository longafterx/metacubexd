import type { Endpoint } from '~/types'
import { defineStore } from 'pinia'
import { hubEndpoint } from '~/utils/hub'

export const useEndpointStore = defineStore('endpoint', () => {
  // State
  const selectedEndpoint = useLocalStorage<string>('selectedEndpoint', '')
  const hubMode = useRuntimeConfig().public.mihomoHub
  const hub = useHubStore()
  const localEndpoints = hubMode
    ? ref<Endpoint[]>([])
    : useLocalStorage<Endpoint[]>('endpointList', [])
  // 列表每 5 秒刷新健康状态；复用 Endpoint 对象，避免实时页误判为切换实例并清空连接。
  const adapted = new Map<string, Endpoint>()
  function serverEndpoints() {
    const list = hub.instances
      .filter((item) => item.enabled)
      .map((item) => {
        const value = hubEndpoint(item, window.location.origin)
        const existing = adapted.get(item.id)
        if (
          existing &&
          existing.url === value.url &&
          existing.label === value.label
        )
          return existing
        adapted.set(item.id, value)
        return value
      })
    for (const id of adapted.keys())
      if (!list.some((item) => item.id === id)) adapted.delete(id)
    return list
  }
  const endpointList = computed<Endpoint[]>({
    get: () => (hubMode ? serverEndpoints() : localEndpoints.value),
    set: (list) => {
      if (!hubMode) localEndpoints.value = list
    },
  })
  if (hubMode)
    watch(
      [endpointList, () => hub.loaded],
      ([list]) => {
        // 首次读取目录前不能把持久化的选择当成已删除实例，否则刷新会跳回第一项。
        if (hub.loaded === false && list.length === 0) return
        if (!list.some((i) => i.id === selectedEndpoint.value))
          selectedEndpoint.value = list[0]?.id || ''
      },
      { immediate: true },
    )

  // Getters
  const currentEndpoint = computed(() =>
    endpointList.value.find(({ id }) => id === selectedEndpoint.value),
  )

  const wsEndpointURL = computed(() => {
    const endpoint = currentEndpoint.value
    if (!endpoint) return ''
    try {
      const parsed = new URL(endpoint.url)
      if (parsed.protocol === 'http:') parsed.protocol = 'ws:'
      if (parsed.protocol === 'https:') parsed.protocol = 'wss:'
      const href = parsed.href
      return href.endsWith('/') ? href.slice(0, -1) : href
    } catch {
      return ''
    }
  })

  // Actions
  const setSelectedEndpoint = (id: string) => {
    selectedEndpoint.value = id
  }

  const setEndpointList = (list: Endpoint[]) => {
    endpointList.value = list
  }

  const addEndpoint = (endpoint: Endpoint) => {
    endpointList.value = [endpoint, ...endpointList.value]
  }

  const removeEndpoint = (id: string) => {
    endpointList.value = endpointList.value.filter((e) => e.id !== id)
    if (selectedEndpoint.value === id) {
      selectedEndpoint.value = ''
    }
  }

  const updateEndpoint = (id: string, updates: Partial<Endpoint>) => {
    const index = endpointList.value.findIndex((e) => e.id === id)
    const existing = endpointList.value[index]
    if (index !== -1 && existing) {
      endpointList.value[index] = { ...existing, ...updates } as Endpoint
    }
  }

  return {
    selectedEndpoint,
    endpointList,
    currentEndpoint,
    wsEndpointURL,
    setSelectedEndpoint,
    setEndpointList,
    addEndpoint,
    removeEndpoint,
    updateEndpoint,
  }
})
