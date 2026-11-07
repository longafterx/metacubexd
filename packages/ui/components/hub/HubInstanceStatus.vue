<script setup lang="ts">
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { IconAntennaBars5 } from '@tabler/icons-vue'
import { useHubConnectionProbe } from '~/composables/useHubConnectionProbe'
import { hubErrorKey } from '~/utils/hub'

const props = defineProps<{
  instanceId: string
  name: string
  statusLabel: string
  current: boolean
}>()
const { t } = useI18n()
const { result, error, loading, probe } = useHubConnectionProbe(
  props.instanceId,
)
const reference = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const tooltipID = `hub-instance-latency-${props.instanceId}`
const { floatingStyles } = useFloating(reference, floating, {
  placement: 'bottom',
  strategy: 'fixed',
  middleware: [offset(8), flip(), shift({ padding: 12 })],
  whileElementsMounted: autoUpdate,
})
const latency = computed(() => {
  const ms = result.value?.latency_ms
  return ms === undefined ? '' : ms < 1 ? '<1 ms' : `${ms} ms`
})
function show() {
  isOpen.value = true
  void probe()
}
</script>

<template>
  <!-- 状态标签只负责展示和悬浮诊断；实例选择统一由下拉菜单处理。 -->
  <span
    ref="reference"
    tabindex="0"
    class="flex max-w-48 shrink-0 cursor-default items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary"
    :aria-current="current ? 'true' : undefined"
    :aria-describedby="isOpen ? tooltipID : undefined"
    :data-hub-instance-status="instanceId"
    @mouseenter="show"
    @mouseleave="isOpen = false"
    @focus="show"
    @blur="isOpen = false"
    @keydown.esc="isOpen = false"
  >
    <IconAntennaBars5 :size="15" class="shrink-0" />
    <span class="truncate">{{ name }}</span>
    <span class="sr-only">{{ statusLabel }}</span>
    <Teleport to="body">
      <div
        v-if="isOpen"
        :id="tooltipID"
        ref="floating"
        role="tooltip"
        :style="floatingStyles"
        class="pointer-events-none z-70 max-w-[min(22rem,calc(100vw-24px))] rounded-xl border border-base-content/15 bg-base-200 px-4 py-3 text-sm text-base-content shadow-xl"
      >
        <p class="truncate font-medium">{{ name }}</p>
        <p v-if="loading" class="mt-1 text-base-content/60">
          {{ t('hub.connectionTesting') }}
        </p>
        <p v-else-if="error" class="mt-1 text-error">
          {{ t(hubErrorKey(error)) }}
        </p>
        <p v-else-if="result" class="mt-1 text-success">
          {{ t('hub.connectionSuccessLatency', { latency }) }}
        </p>
        <p class="mt-1 text-xs text-base-content/50">
          {{ t('hub.connectionLatencySource') }}
        </p>
      </div>
    </Teleport>
  </span>
</template>
