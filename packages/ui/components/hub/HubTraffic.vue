<script setup lang="ts">
import type { HubDimension } from '~/utils/hubAnalytics'
import { useHubHistory } from '~/composables/useHubHistory'
import { hubTrend } from '~/utils/hubAnalytics'

const { t } = useI18n()
const hub = useHubStore()
const { getServerHistory } = useDataUsage()
const { data, loading, error, load, clear } = useHubHistory(getServerHistory)
const scope = ref('all')
const range = ref('24')
const dimension = ref<HubDimension>('host')
const customFrom = ref('')
const customTo = ref('')
const connectionOffset = ref(0)
const gapOffset = ref(0)
const catalog = ref<{ id: string; name: string; deleted: boolean }[]>([])
const chart = computed(() => (data.value ? hubTrend(data.value) : []))
const totals = computed(() => data.value?.summary.data)
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
function page(kind: 'gap' | 'connection', delta: number) {
  const offset = kind === 'gap' ? gapOffset : connectionOffset
  offset.value += delta
  void refresh()
}
async function refresh() {
  // 所有查询共用同一 UTC 窗口；只统计完整时间桶，避免卡片与趋势时间错位。
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
  if (range.value !== 'custom') void refresh()
  else clear()
})
// 全局覆盖信息包含已删除但保留历史的实例，供范围选择器使用。
onMounted(refresh)
</script>

<template>
  <main
    class="mx-auto flex h-full w-full max-w-7xl flex-col gap-5 overflow-y-auto p-4 pb-24 *:shrink-0 sm:p-6"
    data-testid="hub-history"
  >
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">{{ t('hub.history') }}</h1>
        <p class="mt-2 text-sm text-base-content/80">
          {{ t('hub.historyHint') }}
        </p>
      </div>
      <button class="btn btn-sm" :disabled="loading" @click="refresh">
        {{ t('hub.refresh') }}
      </button>
    </div>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="refresh">
      <label class="flex flex-col gap-2 text-sm" for="hub-history-instance"
        >{{ t('hub.scope') }}
        <select id="hub-history-instance" v-model="scope" class="select">
          <option value="all">{{ t('hub.all') }}</option>
          <option v-for="item in options" :key="item.id" :value="item.id">
            {{ item.name }}{{ item.deleted ? ` (${t('hub.retained')})` : '' }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-2 text-sm" for="hub-range"
        >{{ t('hub.range') }}
        <select id="hub-range" v-model="range" class="select">
          <option value="1">{{ t('hub.hour') }}</option>
          <option value="24">{{ t('hub.day') }}</option>
          <option value="168">{{ t('hub.week') }}</option>
          <option value="720">{{ t('hub.month') }}</option>
          <option value="custom">{{ t('hub.custom') }}</option>
        </select>
      </label>
      <template v-if="range === 'custom'">
        <label class="flex flex-col gap-2 text-sm" for="hub-from"
          >{{ t('hub.from')
          }}<input
            id="hub-from"
            v-model="customFrom"
            class="input"
            type="datetime-local"
            required
        /></label>
        <label class="flex flex-col gap-2 text-sm" for="hub-to"
          >{{ t('hub.to')
          }}<input
            id="hub-to"
            v-model="customTo"
            class="input"
            type="datetime-local"
            required
        /></label>
        <button class="btn btn-primary" type="submit" :disabled="loading">
          {{ t('hub.apply') }}
        </button>
      </template>
    </form>
    <p v-if="loading" role="status" class="text-sm">{{ t('hub.loading') }}</p>
    <p v-if="error" role="alert" class="text-error">
      {{ error }}
      <button class="btn btn-ghost btn-sm" @click="refresh">
        {{ t('hub.retry') }}
      </button>
    </p>
    <template v-if="data && totals">
      <p class="text-xs text-base-content/80">
        UTC [{{ data.window.from }}, {{ data.window.to }}) ·
        {{ data.window.step }} · SQLite
      </p>
      <div
        class="grid gap-px overflow-hidden rounded-2xl bg-base-content/10 sm:grid-cols-3"
      >
        <section class="bg-base-200 p-5">
          <h2 class="text-sm">{{ t('hub.total') }}</h2>
          <p
            class="mt-3 text-2xl font-semibold tabular-nums"
            data-testid="hub-total"
          >
            {{ formatBytes(totals.total_upload + totals.total_download) }}
          </p>
          <p class="mt-2 text-xs">
            ↑ {{ formatBytes(totals.total_upload) }} · ↓
            {{ formatBytes(totals.total_download) }}
          </p>
        </section>
        <section class="bg-base-200 p-5">
          <h2 class="text-sm">{{ t('hub.attributed') }}</h2>
          <p class="mt-3 text-2xl font-semibold tabular-nums">
            {{
              formatBytes(totals.attributed_upload + totals.attributed_download)
            }}
          </p>
          <p class="mt-2 text-xs">
            ↑ {{ formatBytes(totals.attributed_upload) }} · ↓
            {{ formatBytes(totals.attributed_download) }}
          </p>
        </section>
        <section class="bg-base-200 p-5">
          <h2 class="text-sm">{{ t('hub.unattributed') }}</h2>
          <p class="mt-3 text-2xl font-semibold tabular-nums">
            {{
              totals.unattributed_upload == null ||
              totals.unattributed_download == null
                ? t('hub.unknown')
                : formatBytes(
                    totals.unattributed_upload + totals.unattributed_download,
                  )
            }}
          </p>
          <p class="mt-2 text-xs">{{ t('hub.sampleHint') }}</p>
        </section>
      </div>
      <p v-if="!totals.consistent" role="status" class="text-sm text-warning">
        {{ t('hub.inconsistent') }}
      </p>
      <p
        v-if="data.summary.meta.has_gap"
        role="status"
        class="border-l-2 border-warning pl-3 text-sm text-warning"
      >
        {{ t('hub.gapWarning') }}
      </p>
      <section class="h-72 shrink-0 rounded-2xl bg-base-200 p-2">
        <TrafficTrendChart
          :data="chart"
          :start-time="data.window.start"
          :end-time="data.window.end"
          :title="t('hub.trend')"
        />
      </section>
      <section class="rounded-2xl bg-base-200 p-4">
        <h2 class="text-lg font-semibold">{{ t('hub.coverage') }}</h2>
        <p class="my-2 text-xs text-base-content/80">
          {{ t('hub.coverageHint') }}
        </p>
        <p v-if="!data.summary.meta.coverage.length" class="py-4 text-sm">
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
      <section class="rounded-2xl bg-base-200 p-4">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="mr-auto text-lg font-semibold">{{ t('hub.top') }}</h2>
          <label for="hub-dimension" class="sr-only">{{
            t('hub.dimension')
          }}</label
          ><select
            id="hub-dimension"
            v-model="dimension"
            class="select select-sm"
          >
            <option
              v-for="kind in [
                'host',
                'proxy',
                'rule',
                'process',
                'src_ip',
              ] as const"
              :key="kind"
              :value="kind"
            >
              {{ t(`hub.dimensions.${kind}`) }}
            </option>
          </select>
        </div>
        <p class="my-2 text-xs text-base-content/80">{{ t('hub.topHint') }}</p>
        <p v-if="!data.top.data.length" class="py-4 text-sm">
          {{ t('hub.empty') }}
        </p>
        <div class="overflow-x-auto">
          <table v-if="data.top.data.length" class="table table-sm">
            <thead>
              <tr>
                <th>{{ t('hub.dimension') }}</th>
                <th>{{ t('upload') }}</th>
                <th>{{ t('download') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.top.data" :key="item.value">
                <td class="max-w-xl break-all whitespace-normal">
                  {{ item.value || t('hub.unknown') }}
                </td>
                <td class="tabular-nums">
                  {{ formatBytes(item.upload_bytes) }}
                </td>
                <td class="tabular-nums">
                  {{ formatBytes(item.download_bytes) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="rounded-2xl bg-base-200 p-4">
        <h2 class="text-lg font-semibold">{{ t('hub.gaps') }}</h2>
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
            >{{ gapOffset + 1 }}–{{ gapOffset + data.gaps.data.length }}</span
          ><button
            class="btn btn-ghost btn-sm"
            :disabled="data.gaps.data.length < 50 || gapOffset >= 100000"
            @click="page('gap', 50)"
          >
            {{ t('hub.next') }}
          </button>
        </div>
      </section>
      <section class="rounded-2xl bg-base-200 p-4">
        <h2 class="text-lg font-semibold">{{ t('hub.connections') }}</h2>
        <p class="my-2 text-xs text-base-content/80">
          {{ t('hub.connectionHint') }}
        </p>
        <p v-if="!data.connectionsAvailable" class="py-4 text-sm">
          {{ t('hub.connectionLimit') }}
        </p>
        <p v-else-if="!data.connections?.data.length" class="py-4 text-sm">
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
                    options.find((i) => i.id === item.instance_id)?.name ||
                    item.instance_id
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
    </template>
  </main>
</template>
