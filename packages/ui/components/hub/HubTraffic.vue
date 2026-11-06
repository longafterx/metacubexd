<script setup lang="ts">
import type { HubDimension } from '~/utils/hubAnalytics'
import {
  IconArrowsExchange,
  IconChevronDown,
  IconClock,
  IconCpu,
  IconDevices,
  IconDownload,
  IconInfoCircle,
  IconRefresh,
  IconRuler,
  IconSum,
  IconUpload,
  IconWorld,
} from '@tabler/icons-vue'
import dayjs from 'dayjs'
import { useHubHistory } from '~/composables/useHubHistory'
import { formatBytes } from '~/utils'
import { hubTrend, hubUsageRows } from '~/utils/hubAnalytics'

const { t } = useI18n()
const hub = useHubStore()
const { getServerHistory } = useDataUsage()
const { data, loading, error, load, clear } = useHubHistory(getServerHistory)
const scope = ref('all')
const range = ref('24')
const dimension = ref<HubDimension>('src_ip')
const customFrom = ref(dayjs().subtract(1, 'day').format('YYYY-MM-DDTHH:mm'))
const customTo = ref(dayjs().format('YYYY-MM-DDTHH:mm'))
const connectionOffset = ref(0)
const gapOffset = ref(0)
const detailsOpen = ref(false)
const selectedRow = ref<string | null>(null)
const catalog = ref<{ id: string; name: string; deleted: boolean }[]>([])
const chart = computed(() => (data.value ? hubTrend(data.value) : []))
const totals = computed(() => data.value?.summary.data)
const rows = computed(() =>
  data.value ? hubUsageRows(data.value.top.data) : [],
)
const views = computed(() => [
  { value: 'src_ip' as const, label: t('devices'), icon: IconDevices },
  { value: 'host' as const, label: t('host'), icon: IconWorld },
  { value: 'proxy' as const, label: t('proxies'), icon: IconArrowsExchange },
  { value: 'rule' as const, label: t('rules'), icon: IconRuler },
  { value: 'process' as const, label: t('process'), icon: IconCpu },
])
const currentView = computed(() =>
  views.value.find((view) => view.value === dimension.value)!,
)
const summaryCards = computed(() => [
  {
    key: 'count',
    label: `${currentView.value.label} · TOP 20`,
    value: String(rows.value.length),
    icon: currentView.value.icon,
    color: 'bg-primary/10 text-primary',
  },
  {
    key: 'upload',
    label: t('upload'),
    value: formatBytes(totals.value?.total_upload ?? 0),
    icon: IconUpload,
    color: 'bg-success/10 text-success',
  },
  {
    key: 'download',
    label: t('download'),
    value: formatBytes(totals.value?.total_download ?? 0),
    icon: IconDownload,
    color: 'bg-info/10 text-info',
  },
  {
    key: 'total',
    label: t('total'),
    value: formatBytes(
      (totals.value?.total_upload ?? 0) + (totals.value?.total_download ?? 0),
    ),
    icon: IconSum,
    color: 'bg-secondary/10 text-secondary',
  },
])
const unavailable = (value: number | null | undefined) =>
  value == null ? t('hub.unknown') : formatBytes(value)
const date = (value: number | null | undefined) =>
  value ? new Date(value).toLocaleString() : t('hub.never')
const options = computed(() => {
  const items = new Map(catalog.value.map((item) => [item.id, item]))
  hub.instances.forEach((item) =>
    items.set(item.id, { ...item, deleted: false }),
  )
  return [...items.values()]
})
function selectRow(value: string) {
  selectedRow.value = selectedRow.value === value ? null : value
}
function page(kind: 'gap' | 'connection', delta: number) {
  const offset = kind === 'gap' ? gapOffset : connectionOffset
  offset.value += delta
  void refresh()
}
async function refresh() {
  // 卡片、趋势与独立维度排行使用同一完整 UTC 窗口；连接摘要仅在采集详情展示。
  const to =
    range.value === 'custom' ? new Date(customTo.value).getTime() : Date.now()
  const from =
    range.value === 'custom'
      ? new Date(customFrom.value).getTime()
      : to - Number(range.value) * 3600000
  await load({
    instance: scope.value,
    from,
    to,
    dimension: dimension.value,
    connectionOffset: connectionOffset.value,
    gapOffset: gapOffset.value,
  })
  if (data.value && scope.value === 'all') {
    catalog.value = data.value.summary.meta.coverage.map((item) => ({
      id: item.instance_id,
      name: item.name,
      deleted: item.deleted,
    }))
  }
}
watch([scope, range, dimension], () => {
  connectionOffset.value = 0
  gapOffset.value = 0
  selectedRow.value = null
  if (range.value !== 'custom') void refresh()
  else clear()
})
// 全局覆盖信息包含保留历史的已删除实例；不读取或混用浏览器 IndexedDB。
onMounted(refresh)
</script>

<template>
  <main
    class="flex h-full min-w-0 flex-col gap-4 overflow-hidden"
    data-testid="hub-history"
  >
    <div
      class="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1"
    >
      <nav
        class="flex shrink-0 gap-1 rounded-lg border border-base-content/12 bg-base-200/60 p-1"
        :aria-label="t('hub.dimension')"
        data-testid="hub-usage-views"
      >
        <button
          v-for="view in views"
          :key="view.value"
          class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[0.8125rem] font-medium text-base-content/60 transition-colors hover:bg-base-content/5 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary"
          :class="
            dimension === view.value
              ? 'bg-primary! text-primary-content! shadow-sm'
              : ''
          "
          :aria-pressed="dimension === view.value"
          :aria-label="view.label"
          :title="view.label"
          :data-hub-dimension="view.value"
          @click="dimension = view.value"
        >
          <component :is="view.icon" :size="16" /><span
            class="hidden sm:inline"
            >{{ view.label }}</span
          >
        </button>
      </nav>
      <form
        class="flex min-w-0 flex-wrap items-center gap-2"
        @submit.prevent="refresh"
      >
        <label
          class="flex min-w-0 items-center gap-2 text-xs text-base-content/50"
          for="hub-history-instance"
          ><span class="sr-only">{{ t('hub.scope') }}</span>
          <select
            id="hub-history-instance"
            v-model="scope"
            class="max-w-44 cursor-pointer rounded-lg border border-base-content/12 bg-base-200/60 px-2 py-1.5 text-[0.8125rem] text-base-content focus:border-primary focus:outline-none"
          >
            <option value="all">{{ t('hub.all') }}</option>
            <option v-for="item in options" :key="item.id" :value="item.id">
              {{ item.name }}{{ item.deleted ? ` (${t('hub.retained')})` : '' }}
            </option>
          </select>
        </label>
        <label
          class="flex items-center gap-2 text-xs text-base-content/50"
          for="hub-range"
          ><span class="hidden md:inline">{{ t('timeRange') }}</span
          ><span class="sr-only md:hidden">{{ t('timeRange') }}</span>
          <select
            id="hub-range"
            v-model="range"
            class="cursor-pointer rounded-lg border border-base-content/12 bg-base-200/60 px-2 py-1.5 text-[0.8125rem] text-base-content focus:border-primary focus:outline-none"
          >
            <option value="1">{{ t('lastHour') }}</option>
            <option value="24">{{ t('lastDay') }}</option>
            <option value="168">{{ t('lastWeek') }}</option>
            <option value="720">{{ t('lastMonth') }}</option>
            <option value="custom">{{ t('customRange') }}</option>
          </select>
        </label>
        <button
          type="submit"
          class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-base-content/12 bg-base-200/60 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
          :disabled="loading"
          :aria-label="t('hub.refresh')"
          :title="t('hub.refresh')"
        >
          <IconRefresh :size="16" :class="{ 'animate-spin': loading }" />
        </button>
      </form>
      <form
        v-if="range === 'custom'"
        class="flex w-full flex-wrap items-end gap-3"
        @submit.prevent="refresh"
      >
        <label
          class="flex min-w-0 flex-col gap-1 text-xs text-base-content/60"
          for="hub-from"
          >{{ t('hub.from')
          }}<input
            id="hub-from"
            v-model="customFrom"
            type="datetime-local"
            required
            class="min-w-0 rounded-lg border border-base-content/12 bg-base-200/60 p-2 text-xs text-base-content focus:border-primary focus:outline-none"
        /></label>
        <label
          class="flex min-w-0 flex-col gap-1 text-xs text-base-content/60"
          for="hub-to"
          >{{ t('hub.to')
          }}<input
            id="hub-to"
            v-model="customTo"
            type="datetime-local"
            required
            class="min-w-0 rounded-lg border border-base-content/12 bg-base-200/60 p-2 text-xs text-base-content focus:border-primary focus:outline-none"
        /></label>
        <button
          class="btn btn-primary btn-sm"
          type="submit"
          :disabled="loading"
        >
          {{ t('hub.apply') }}
        </button>
      </form>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      <div class="flex min-w-0 flex-col gap-4 pb-4">
        <div
          v-if="loading"
          role="status"
          class="space-y-4"
          :aria-label="t('hub.loading')"
        >
          <span class="sr-only">{{ t('hub.loading') }}</span>
          <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div
              v-for="i in 4"
              :key="i"
              class="h-20 animate-pulse rounded-2xl bg-base-200/60"
            />
          </div>
          <div class="h-80 animate-pulse rounded-xl bg-base-200/60" />
        </div>
        <p
          v-if="error"
          role="alert"
          class="rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error"
        >
          {{ error }}
          <button class="btn btn-ghost btn-sm" @click="refresh">
            {{ t('hub.retry') }}
          </button>
        </p>
        <template v-if="data && totals">
          <div
            class="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4"
            data-testid="hub-usage-summary"
          >
            <section
              v-for="card in summaryCards"
              :key="card.key"
              class="relative flex h-16 min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-base-content/10 bg-base-200/50 p-3 shadow-sm xl:h-20"
            >
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-lg xl:size-10 xl:rounded-xl"
                :class="card.color"
                ><component :is="card.icon" :size="18"
              /></span>
              <div class="flex min-w-0 flex-col gap-1">
                <h2
                  class="truncate text-[10px] leading-none text-base-content/50"
                >
                  {{ card.label }}
                </h2>
                <p
                  class="text-sm leading-tight font-bold tabular-nums xl:text-lg"
                  :class="card.key === 'total' ? 'text-secondary' : ''"
                  :data-testid="
                    card.key === 'total' ? 'hub-total' : `hub-${card.key}`
                  "
                >
                  {{ card.value }}
                </p>
              </div>
              <span
                v-if="card.key === 'total'"
                class="absolute top-1 right-2 flex items-center gap-1 text-[10px] text-base-content/30"
                :title="range === 'custom' ? `${customFrom} → ${customTo}` : ''"
                ><IconClock :size="11" />{{
                  range === 'custom'
                    ? t('hub.custom')
                    : `${Number(range) / (Number(range) >= 24 ? 24 : 1)}${Number(range) >= 24 ? 'D' : 'H'}`
                }}</span
              >
            </section>
          </div>
          <p
            v-if="!totals.consistent || data.summary.meta.has_gap"
            role="status"
            class="flex items-center gap-2 px-1 text-xs text-warning"
          >
            <IconInfoCircle :size="15" class="shrink-0" />{{
              !totals.consistent ? t('hub.inconsistent') : t('hub.gapWarning')
            }}
          </p>
          <div class="grid shrink-0 grid-cols-1 gap-4 xl:h-80 xl:grid-cols-4">
            <section
              class="col-span-1 min-h-52 min-w-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-4 shadow-sm xl:h-full"
            >
              <TrafficRankings
                :title="
                  t('hub.usage.ranking', { dimension: currentView.label })
                "
                :icon="currentView.icon"
                :data="rows"
                :selected-row="selectedRow"
                :empty-label="t('hub.unknown')"
                @select="selectRow"
              />
            </section>
            <section
              class="col-span-1 h-80 min-w-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-2 shadow-sm xl:col-span-3 xl:h-full"
            >
              <TrafficTrendChart
                :data="chart"
                :start-time="data.window.start"
                :end-time="data.window.end"
                :title="t('traffic')"
              />
            </section>
          </div>
          <HubUsageTable
            :key="`${scope}:${dimension}:${range}`"
            :rows="rows"
            :label="currentView.label"
            :selected="selectedRow"
            @select="selectRow"
          />
          <details
            :open="detailsOpen"
            class="group rounded-xl border border-base-content/10 bg-base-200/40"
            data-testid="hub-collection-details"
            @toggle="detailsOpen = ($event.target as HTMLDetailsElement).open"
          >
            <summary
              class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs text-base-content/60 transition-colors hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary"
            >
              <IconInfoCircle :size="15" /><span class="mr-auto">{{
                t('hub.usage.collectionDetails')
              }}</span
              ><IconChevronDown
                :size="15"
                class="transition-transform group-open:rotate-180"
              />
            </summary>
            <div
              class="flex flex-col gap-4 border-t border-base-content/10 p-4"
            >
              <p class="text-xs leading-relaxed text-base-content/60">
                {{ t('hub.historyHint') }} {{ t('hub.topHint') }}
              </p>
              <dl class="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt class="text-xs text-base-content/60">
                    {{ t('hub.attributed') }}
                  </dt>
                  <dd class="mt-1 font-semibold tabular-nums">
                    {{
                      formatBytes(
                        totals.attributed_upload + totals.attributed_download,
                      )
                    }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-base-content/60">
                    {{ t('hub.unattributed') }}
                  </dt>
                  <dd class="mt-1 font-semibold tabular-nums">
                    {{
                      totals.unattributed_upload == null ||
                      totals.unattributed_download == null
                        ? t('hub.unknown')
                        : formatBytes(
                            totals.unattributed_upload +
                              totals.unattributed_download,
                          )
                    }}
                  </dd>
                </div>
              </dl>
              <section class="min-w-0 border-t border-base-content/10 pt-4">
                <h2 class="text-sm font-semibold">{{ t('hub.coverage') }}</h2>
                <p class="my-2 text-xs text-base-content/80">
                  {{ t('hub.coverageHint') }}
                </p>
                <p
                  v-if="!data.summary.meta.coverage.length"
                  class="py-4 text-sm"
                >
                  {{ t('hub.empty') }}
                </p>
                <div
                  v-for="item in data.summary.meta.coverage"
                  :key="item.instance_id"
                  class="flex flex-wrap gap-x-6 gap-y-2 border-t border-base-content/10 py-3 text-sm"
                >
                  <span class="min-w-32 font-medium"
                    >{{ item.name
                    }}{{ item.deleted ? ` (${t('hub.retained')})` : '' }}</span
                  >
                  <span class="tabular-nums"
                    >{{ (item.sample_coverage * 100).toFixed(1) }}%</span
                  >
                  <span
                    >{{ t('hub.retentionStart') }}:
                    {{
                      date(
                        data.window.step === '1m'
                          ? item.first_retained_minute_ms
                          : item.first_retained_hour_ms,
                      )
                    }}</span
                  >
                  <span
                    >{{ t('hub.lastSample') }}:
                    {{ date(item.last_snapshot_at_ms) }}</span
                  >
                  <span v-if="item.has_gap" class="text-warning">{{
                    t('hub.gapWarning')
                  }}</span>
                </div>
              </section>
              <section class="min-w-0 border-t border-base-content/10 pt-4">
                <h2 class="text-sm font-semibold">{{ t('hub.gaps') }}</h2>
                <p class="my-2 text-xs text-base-content/80">
                  {{ t('hub.candidateHint') }}
                </p>
                <p v-if="!data.gaps.data.length" class="py-4 text-sm">
                  {{ t('hub.empty') }}
                </p>
                <article
                  v-for="item in data.gaps.data"
                  :key="item.id"
                  class="border-t border-base-content/10 py-3 text-sm"
                >
                  <p>
                    {{
                      options.find((i) => i.id === item.instance_id)?.name ||
                      item.instance_id
                    }}
                    · {{ item.reason }} · {{ item.resolution }}
                  </p>
                  <p class="mt-1 text-xs">
                    {{ date(item.from_ms) }} →
                    {{ item.to_ms ? date(item.to_ms) : t('hub.ongoing') }} · ↑
                    {{ unavailable(item.candidate_upload_bytes) }} · ↓
                    {{ unavailable(item.candidate_download_bytes) }}
                  </p>
                </article>
                <div class="mt-3 flex items-center gap-3 text-xs">
                  <button
                    class="btn btn-ghost btn-sm"
                    :disabled="gapOffset === 0"
                    @click="page('gap', -50)"
                  >
                    {{ t('hub.previous') }}</button
                  ><span
                    >{{ gapOffset + 1 }}–{{
                      gapOffset + data.gaps.data.length
                    }}</span
                  ><button
                    class="btn btn-ghost btn-sm"
                    :disabled="
                      data.gaps.data.length < 50 || gapOffset >= 100000
                    "
                    @click="page('gap', 50)"
                  >
                    {{ t('hub.next') }}
                  </button>
                </div>
              </section>
              <section class="min-w-0 border-t border-base-content/10 pt-4">
                <h2 class="text-sm font-semibold">
                  {{ t('hub.connections') }}
                </h2>
                <p class="my-2 text-xs text-base-content/80">
                  {{ t('hub.connectionHint') }}
                </p>
                <p v-if="!data.connectionsAvailable" class="py-4 text-sm">
                  {{ t('hub.connectionLimit') }}
                </p>
                <p
                  v-else-if="!data.connections?.data.length"
                  class="py-4 text-sm"
                >
                  {{ t('hub.empty') }}
                </p>
                <div v-else class="overflow-x-auto">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>{{ t('hub.name') }}</th>
                        <th>{{ t('hub.dimensions.host') }}</th>
                        <th>{{ t('hub.dimensions.proxy') }}</th>
                        <th>{{ t('hub.lastSeen') }}</th>
                        <th>{{ t('upload') }}</th>
                        <th>{{ t('download') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="item in data.connections.data"
                        :key="`${item.instance_id}:${item.lifecycle_id}`"
                      >
                        <td>
                          {{
                            options.find((i) => i.id === item.instance_id)
                              ?.name || item.instance_id
                          }}
                        </td>
                        <td>{{ item.host }}</td>
                        <td>{{ item.proxy }}</td>
                        <td>{{ date(item.last_seen_at_ms) }}</td>
                        <td>{{ formatBytes(item.lifetime_upload_bytes) }}</td>
                        <td>{{ formatBytes(item.lifetime_download_bytes) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div
                  v-if="data.connectionsAvailable"
                  class="mt-3 flex items-center gap-3 text-xs"
                >
                  <button
                    class="btn btn-ghost btn-sm"
                    :disabled="connectionOffset === 0"
                    @click="page('connection', -50)"
                  >
                    {{ t('hub.previous') }}</button
                  ><span
                    >{{ connectionOffset + 1 }}–{{
                      connectionOffset + (data.connections?.data.length || 0)
                    }}</span
                  ><button
                    class="btn btn-ghost btn-sm"
                    :disabled="
                      (data.connections?.data.length || 0) < 50 ||
                      connectionOffset >= 100000
                    "
                    @click="page('connection', 50)"
                  >
                    {{ t('hub.next') }}
                  </button>
                </div>
              </section>
            </div>
          </details>
        </template>
      </div>
    </div>
  </main>
</template>
