import type { HubHistory, HubHistoryQuery } from '~/utils/hubAnalytics'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { getHubHistory } from '~/utils/hubAnalytics'

export function useHubHistory(loader = getHubHistory) {
  const data = shallowRef<HubHistory | null>(null)
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | undefined
  function clear() {
    // 切换筛选立即清空旧值；即使底层请求忽略取消，也不能回填旧实例数据。
    generation++
    controller?.abort()
    data.value = null
    error.value = ''
    loading.value = false
  }
  async function load(query: HubHistoryQuery) {
    const current = ++generation
    controller?.abort()
    controller = new AbortController()
    data.value = null
    error.value = ''
    loading.value = true
    try {
      const result = await loader(query, controller.signal)
      if (current === generation) data.value = result
    } catch (cause) {
      if (current === generation)
        error.value = cause instanceof Error ? cause.message : 'Request failed'
    } finally {
      if (current === generation) loading.value = false
    }
  }
  onScopeDispose(() => {
    generation++
    controller?.abort()
  })
  return { data, loading, error, load, clear }
}
