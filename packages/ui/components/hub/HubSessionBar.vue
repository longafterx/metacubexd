<script setup lang="ts">
const hub = useHubStore()
const endpoint = useEndpointStore()
const { t } = useI18n()
const logoutError = ref('')
onMounted(() => {
  hub.refresh(true).catch(() => {})
})
const timer = useIntervalFn(() => hub.refresh(true).catch(() => {}), 5000)
onBeforeUnmount(() => timer.pause())
async function logout() {
  try {
    await hub.logout()
  } catch (e) {
    logoutError.value = e instanceof Error ? e.message : t('hub.failed')
  }
}
</script>
<template>
  <header
    class="flex shrink-0 flex-wrap items-center gap-3 border-b border-base-content/10 bg-base-200 px-4 py-2 text-sm"
    data-testid="hub-session"
  >
    <NuxtLink to="/setup" class="font-semibold text-primary"
      >MihomoHub</NuxtLink
    >
    <label for="hub-endpoint" class="sr-only">{{ t('hub.current') }}</label>
    <select
      id="hub-endpoint"
      :value="endpoint.selectedEndpoint"
      class="select max-w-52 select-sm"
      @change="
        endpoint.setSelectedEndpoint(($event.target as HTMLSelectElement).value)
      "
    >
      <option v-if="!endpoint.endpointList.length" value="">
        {{ t('hub.noEnabled') }}
      </option>
      <option
        v-for="item in endpoint.endpointList"
        :key="item.id"
        :value="item.id"
      >
        {{ item.label }}
      </option>
    </select>
    <NuxtLink to="/setup" class="hover:text-primary">{{
      t('hub.instances')
    }}</NuxtLink>
    <NuxtLink to="/traffic" class="hover:text-primary">{{
      t('hub.history')
    }}</NuxtLink>
    <span v-if="hub.error || logoutError" role="alert" class="text-error">{{
      hub.error || logoutError
    }}</span>
    <button class="btn ml-auto btn-ghost btn-sm" @click="logout">
      {{ t('hub.logout') }}
    </button>
  </header>
</template>
