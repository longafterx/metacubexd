import { useQueryClient } from '@tanstack/vue-query'
import { watch } from 'vue'
import { queryKeys } from './useQueries'

/** 在观察者切换到目标实例前清除其旧快照，强制从当前内核重新读取。 */
export function useHubInstanceQueries() {
  const endpoint = useEndpointStore()
  const client = useQueryClient()
  watch(
    () => endpoint.selectedEndpoint,
    (id) => {
      if (!id) return
      for (const base of Object.values(queryKeys))
        client.removeQueries({ queryKey: [...base, id], exact: true })
    },
    { flush: 'sync' },
  )
}
