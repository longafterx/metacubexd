import type { HubInstance } from '~/utils/hub'
import { defineStore } from 'pinia'
import { hubRequest } from '~/utils/hub'

export const useHubStore = defineStore('mihomoHub', () => {
  const instances = ref<HubInstance[]>([])
  const loaded = ref(false)
  const error = ref('')
  let pending: Promise<void> | undefined
  async function refresh(force = false) {
    if (pending) return pending
    if (loaded.value && !force) return
    pending = (async () => {
      try {
        instances.value = (
          await hubRequest<HubInstance[]>('/api/v1/instances')
        ).data
        loaded.value = true
        error.value = ''
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Request failed'
        throw e
      } finally {
        pending = undefined
      }
    })()
    return pending
  }
  async function save(id: string | null, body: Record<string, unknown>) {
    await hubRequest(`/api/v1/instances${id ? `/${id}` : ''}`, {
      method: id ? 'PATCH' : 'POST',
      body,
    })
    await refresh(true)
  }
  async function remove(id: string, history: 'retain' | 'purge') {
    await hubRequest(`/api/v1/instances/${id}?history=${history}`, {
      method: 'DELETE',
    })
    await refresh(true)
  }
  async function logout() {
    await hubRequest('/api/v1/auth/logout', { method: 'POST' })
    instances.value = []
    window.location.assign('/login')
  }
  return { instances, loaded, error, refresh, save, remove, logout }
})
