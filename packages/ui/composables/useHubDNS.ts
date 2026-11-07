import { hubRequest } from '~/utils/hub'

export interface HubDNS {
  enable: boolean
  listen: string
  'enhanced-mode': string
  nameserver: string[]
  fallback: string[]
  'fake-ip-range': string
  'use-hosts': boolean
}
export interface HubRuntimeConfig {
  imported: boolean
  revision: number
  updated_at_ms: number
  dns: HubDNS
}

/** 完整 YAML 只上传到 Go，浏览器只保留当前 DNS 表单，不落 localStorage。 */
export function useHubDNS(instanceID: string, request = hubRequest) {
  const path = `/api/v1/instances/${encodeURIComponent(instanceID)}/runtime-config`
  const view = ref<HubRuntimeConfig | null>(null)
  const busy = ref(false)
  const loading = ref(false)
  const error = shallowRef<unknown>(null)
  const form = reactive({
    enable: true,
    listen: '',
    enhancedMode: 'fake-ip',
    nameserver: '',
    fallback: '',
    fakeIPRange: '',
    useHosts: false,
  })
  function sync(data: HubRuntimeConfig) {
    view.value = data
    const dns = data.dns
    form.enable = dns.enable
    form.listen = dns.listen
    form.enhancedMode = dns['enhanced-mode']
    form.nameserver = (dns.nameserver ?? []).join('\n')
    form.fallback = (dns.fallback ?? []).join('\n')
    form.fakeIPRange = dns['fake-ip-range']
    form.useHosts = dns['use-hosts']
  }
  async function load() {
    if (busy.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      sync((await request<HubRuntimeConfig>(path)).data)
    } catch (e) {
      view.value = null
      error.value = e
    } finally {
      loading.value = false
    }
  }
  async function mutate(method: string, suffix: string, body: unknown) {
    if (busy.value || !view.value) return false
    busy.value = true
    error.value = null
    try {
      sync(
        (await request<HubRuntimeConfig>(path + suffix, { method, body })).data,
      )
      return true
    } catch (e) {
      error.value = e
      return false
    } finally {
      busy.value = false
    }
  }
  const importYAML = (yaml: string) =>
    mutate('PUT', '', { yaml, revision: view.value?.revision })
  const apply = () => {
    if (!view.value?.imported) return Promise.resolve(false)
    const lines = (text: string) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    return mutate('PATCH', '/dns', {
      revision: view.value.revision,
      dns: {
        enable: form.enable,
        listen: form.listen.trim(),
        'enhanced-mode': form.enhancedMode,
        nameserver: lines(form.nameserver),
        fallback: lines(form.fallback),
        'fake-ip-range': form.fakeIPRange.trim(),
        'use-hosts': form.useHosts,
      },
    })
  }
  return { view, form, busy, loading, error, load, importYAML, apply }
}
