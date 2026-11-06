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
  const endpointList = computed<Endpoint[]>({
    get: () =>
      hubMode
        ? hub.instances
            .filter((i) => i.enabled)
            .map((i) => hubEndpoint(i, window.location.origin))
        : localEndpoints.value,
    set: (list) => {
      if (!hubMode) localEndpoints.value = list
    },
  })
  if (hubMode)
    watch(
      endpointList,
      (list) => {
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
