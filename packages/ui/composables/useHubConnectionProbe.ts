import { onScopeDispose, ref, shallowRef } from 'vue'
import { hubRequest } from '~/utils/hub'

interface ProbeResult {
  reachable: boolean
  version: string
  latency_ms: number
}

/** 按需测量 Hub → Controller 的 HTTP 耗时；缓存 30 秒，不启动轮询。 */
export function useHubConnectionProbe(
  instanceID: string,
  request = hubRequest,
) {
  const result = shallowRef<ProbeResult | null>(null)
  const error = shallowRef<unknown>(null)
  const loading = ref(false)
  const controller = new AbortController()
  let checkedAt: number | undefined
  let pending: Promise<void> | undefined

  function probe() {
    if (pending) return pending
    if (controller.signal.aborted) return Promise.resolve()
    if (checkedAt !== undefined && Date.now() - checkedAt < 30_000)
      return Promise.resolve()
    loading.value = true
    result.value = null
    error.value = null
    pending = (async () => {
      try {
        const { data } = await request<ProbeResult>(
          `/api/v1/instances/${encodeURIComponent(instanceID)}/test`,
          { method: 'POST', signal: controller.signal },
        )
        if (controller.signal.aborted) return
        if (
          !data.reachable ||
          !Number.isFinite(data.latency_ms) ||
          data.latency_ms < 0
        )
          throw new Error('Invalid connection probe result')
        result.value = data
      } catch (cause) {
        if (!controller.signal.aborted) error.value = cause
      } finally {
        checkedAt = Date.now()
        loading.value = false
        pending = undefined
      }
    })()
    return pending
  }
  onScopeDispose(() => controller.abort())
  return { result, error, loading, probe }
}
