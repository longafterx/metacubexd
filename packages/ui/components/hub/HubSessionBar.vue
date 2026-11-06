<script setup lang="ts">
import type { HubInstance } from '~/utils/hub'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import {
  IconAntennaBars5,
  IconChevronDown,
  IconServer,
  IconSettings,
} from '@tabler/icons-vue'
import { useMenuKeyboard } from '~/composables/useMenuKeyboard'

const hub = useHubStore()
const endpoint = useEndpointStore()
const { t } = useI18n()
const logoutError = ref('')
const reference = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const current = computed(() =>
  hub.instances.find((item) => item.id === endpoint.selectedEndpoint),
)
const { floatingStyles } = useFloating(reference, floating, {
  placement: 'bottom-start',
  middleware: [offset(8), flip(), shift({ padding: 12 })],
  whileElementsMounted: autoUpdate,
})
const close = () => {
  isOpen.value = false
}
const { onKeydown } = useMenuKeyboard({
  isOpen,
  triggerEl: reference,
  menuEl: floating,
  close,
})

// 切换只改变浏览器当前查看的实例；后台采集始终由 Hub 独立运行。
function select(item: HubInstance) {
  endpoint.setSelectedEndpoint(item.id)
  close()
}
function statusKey(item: HubInstance) {
  return item.collector_status === 'online'
    ? 'hub.collecting'
    : `hub.status.${item.collector_status}`
}
function statusClass(item: HubInstance) {
  if (item.collector_status === 'online')
    return 'border-success/30 bg-success/8 text-success'
  if (['degraded', 'capacity_limited'].includes(item.collector_status))
    return 'border-warning/30 bg-warning/8 text-warning'
  return 'border-base-content/15 bg-base-content/5 text-base-content/60'
}
function onClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (!reference.value?.contains(target) && !floating.value?.contains(target))
    close()
}
onMounted(() => {
  hub.refresh(true).catch(() => {})
  document.addEventListener('click', onClickOutside)
})
const timer = useIntervalFn(() => hub.refresh(true).catch(() => {}), 5000)
onBeforeUnmount(() => {
  timer.pause()
  document.removeEventListener('click', onClickOutside)
})
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
    class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-base-content/10 bg-base-200 px-4 py-3 text-sm"
    data-testid="hub-session"
  >
    <button
      id="hub-endpoint"
      ref="reference"
      class="flex max-w-64 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl bg-base-100 px-3 py-2.5 font-semibold transition-colors hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-primary"
      aria-haspopup="menu"
      aria-controls="hub-instance-menu"
      :aria-label="t('hub.switchInstance')"
      :aria-expanded="isOpen"
      @click.stop="isOpen = !isOpen"
      @keydown.down.prevent="isOpen = true"
      @keydown.up.prevent="isOpen = true"
    >
      <IconServer :size="20" class="shrink-0 text-base-content/70" />
      <span class="truncate">{{ current?.name || t('hub.instances') }}</span>
      <IconChevronDown
        :size="16"
        class="shrink-0 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>
    <div
      class="order-last flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 sm:order-none sm:w-auto sm:flex-1 sm:pb-0"
      :aria-label="t('hub.instanceStatus')"
      data-testid="hub-instance-status"
    >
      <button
        v-for="item in hub.instances"
        :key="item.id"
        class="flex max-w-48 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:brightness-125 focus-visible:outline-2 focus-visible:outline-primary"
        :class="statusClass(item)"
        :aria-pressed="endpoint.selectedEndpoint === item.id"
        :title="`${item.name} · ${t(statusKey(item))}`"
        :data-hub-quick-instance="item.id"
        @click="select(item)"
      >
        <IconAntennaBars5 :size="15" class="shrink-0" />
        <span class="truncate">{{ item.name }}</span>
        <span class="sr-only">{{ t(statusKey(item)) }}</span>
      </button>
      <span v-if="!hub.instances.length" class="text-xs text-base-content/50">{{
        t('hub.emptyInstances')
      }}</span>
    </div>
    <NuxtLink to="/traffic" class="ml-auto shrink-0 hover:text-primary">{{
      t('dataUsage')
    }}</NuxtLink>
    <button class="btn shrink-0 btn-ghost btn-sm" @click="logout">
      {{ t('hub.logout') }}
    </button>
    <span
      v-if="hub.error || logoutError"
      role="alert"
      class="w-full text-xs text-error"
      >{{ hub.error ? t('hub.listRefreshFailed') : logoutError }}</span
    >
    <Teleport to="body">
      <div
        v-if="isOpen"
        id="hub-instance-menu"
        ref="floating"
        :style="floatingStyles"
        role="menu"
        :aria-label="t('hub.instances')"
        class="z-70 w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-base-content/15 bg-base-200 shadow-xl"
        @keydown="onKeydown"
      >
        <p class="border-b border-base-content/10 px-4 py-3 font-semibold">
          {{ t('hub.instances') }}
        </p>
        <ul class="max-h-80 space-y-1 overflow-y-auto p-2">
          <li v-for="item in hub.instances" :key="item.id">
            <button
              role="menuitem"
              :data-current="endpoint.selectedEndpoint === item.id"
              :data-hub-menu-instance="item.id"
              class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-primary"
              :class="
                endpoint.selectedEndpoint === item.id ? 'bg-primary/8' : ''
              "
              @click="select(item)"
            >
              <span
                class="min-w-0 truncate text-sm font-medium"
                :title="item.name"
                >{{ item.name }}</span
              >
              <span
                class="flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs"
                :class="
                  endpoint.selectedEndpoint === item.id
                    ? 'border-primary bg-primary text-primary-content'
                    : statusClass(item)
                "
              >
                <IconAntennaBars5
                  v-if="endpoint.selectedEndpoint !== item.id"
                  :size="14"
                />
                {{
                  t(
                    endpoint.selectedEndpoint === item.id
                      ? 'hub.displaying'
                      : statusKey(item),
                  )
                }}
              </span>
            </button>
          </li>
          <li
            v-if="!hub.instances.length"
            class="p-3 text-sm text-base-content/60"
          >
            {{ t('hub.emptyInstances') }}
          </li>
        </ul>
        <NuxtLink
          to="/setup"
          role="menuitem"
          class="flex items-center gap-3 border-t border-base-content/10 px-5 py-3.5 text-sm hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-primary"
          @click="close"
        >
          <IconSettings :size="18" class="text-base-content/60" />{{
            t('hub.manageInstances')
          }}
        </NuxtLink>
      </div>
    </Teleport>
  </header>
</template>
