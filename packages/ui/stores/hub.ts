import type { HubInstance } from '~/utils/hub'
import { defineStore } from 'pinia'
import { hubRequest } from '~/utils/hub'

export const useHubStore = defineStore('mihomoHub', () => {
  const instances = ref<HubInstance[]>([])
  const loaded = ref(false)
  const error = ref('')
  let pending: Promise<void> | undefined
  let revision = 0
  async function refresh(force = false) {
    if (pending) return pending
    if (loaded.value && !force) return
    const startedAt = revision
    pending = (async () => {
      try {
        const data = (await hubRequest<HubInstance[]>('/api/v1/instances')).data
        // 写入成功后，先前发出的轮询已过期，不能覆盖已提交的增删改结果。
        if (startedAt !== revision) return
        instances.value = data
        loaded.value = true
        error.value = ''
      } catch (e) {
        if (startedAt !== revision) return
        error.value = e instanceof Error ? e.message : 'Request failed'
        throw e
      } finally {
        pending = undefined
      }
    })()
    return pending
  }
  async function save(id: string | null, body: Record<string, unknown>) {
    const { data } = await hubRequest<HubInstance>(
      `/api/v1/instances${id ? `/${id}` : ''}`,
      {
        method: id ? 'PATCH' : 'POST',
        body,
      },
    )
    // 以变更接口的响应为准；后续读取失败不能把成功写入报成失败。
    revision++
    const existing = instances.value.some((item) => item.id === data.id)
    instances.value = existing
      ? instances.value.map((item) => (item.id === data.id ? data : item))
      : [...instances.value, data]
  }
  async function remove(id: string, history: 'retain' | 'purge') {
    await hubRequest(`/api/v1/instances/${id}?history=${history}`, {
      method: 'DELETE',
    })
    revision++
    instances.value = instances.value.filter((item) => item.id !== id)
  }
  async function logout() {
    await hubRequest('/api/v1/auth/logout', { method: 'POST' })
    instances.value = []
    window.location.assign('/login')
  }
  return { instances, loaded, error, refresh, save, remove, logout }
})
