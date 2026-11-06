<script setup lang="ts">
import type { HubUsageRow } from '~/utils/hubAnalytics'
import {
  IconListDetails,
  IconSearch,
  IconSelector,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-vue'
import { formatBytes } from '~/utils'
import { filterHubUsage } from '~/utils/hubAnalytics'

const props = defineProps<{
  rows: HubUsageRow[]
  label: string
  selected: string | null
}>()
const emit = defineEmits<{ select: [value: string] }>()
const { t } = useI18n()
const search = ref('')
const sort = ref<'label' | 'upload' | 'download' | 'total'>('total')
const descending = ref(true)
const visible = computed(() =>
  filterHubUsage(props.rows, search.value, sort.value, descending.value),
)
const columns = computed(() => [
  { key: 'label' as const, label: props.label },
  { key: 'upload' as const, label: t('upload') },
  { key: 'download' as const, label: t('download') },
  { key: 'total' as const, label: t('total') },
])
function sortBy(field: typeof sort.value) {
  descending.value =
    sort.value === field ? !descending.value : field !== 'label'
  sort.value = field
}
</script>

<template>
  <section
    class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-base-content/10 bg-base-200/50 shadow-sm"
    data-testid="hub-usage-details"
  >
    <div
      class="flex flex-wrap items-center gap-3 border-b border-base-content/5 bg-base-300/30 px-4 py-3"
    >
      <IconListDetails :size="20" class="shrink-0 text-primary" />
      <h2 class="mr-auto font-semibold tracking-tight">
        {{ t('hub.usage.details') }}
      </h2>
      <label class="relative w-full sm:w-64">
        <span class="sr-only">{{ t('hub.usage.search') }}</span>
        <IconSearch
          :size="14"
          class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base-content/40"
        />
        <input
          v-model="search"
          type="search"
          class="w-full rounded-lg border border-base-content/12 bg-base-200/60 py-1.5 pr-3 pl-9 text-[0.8125rem] transition-colors placeholder:text-base-content/40 focus:border-primary focus:outline-none"
          :placeholder="t('search')"
          :aria-label="t('hub.usage.search')"
        />
      </label>
    </div>
    <p class="px-4 py-2 text-xs leading-relaxed text-base-content/50">
      {{ t('hub.usage.tableHint') }}
    </p>
    <div class="max-h-[32rem] min-h-48 overflow-auto">
      <table
        class="table w-full table-fixed table-sm"
        :aria-label="t('hub.usage.details')"
      >
        <thead class="sticky top-0 z-10 bg-base-200">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 font-medium text-base-content/60"
              :class="
                column.key === 'label'
                  ? 'w-[70%] sm:w-[46%]'
                  : column.key === 'total'
                    ? 'w-[30%] sm:w-[18%]'
                    : 'hidden w-[18%] sm:table-cell'
              "
              :aria-sort="
                sort !== column.key
                  ? 'none'
                  : descending
                    ? 'descending'
                    : 'ascending'
              "
            >
              <button
                class="flex w-full cursor-pointer items-center gap-1 text-xs hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                :class="
                  column.key === 'label' ? 'justify-start' : 'justify-end'
                "
                @click="sortBy(column.key)"
              >
                {{ column.label }}
                <component
                  :is="
                    sort !== column.key
                      ? IconSelector
                      : descending
                        ? IconSortDescending
                        : IconSortAscending
                  "
                  :size="13"
                  class="shrink-0"
                  :class="sort === column.key ? 'text-primary' : 'opacity-30'"
                />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in visible"
            :key="row.label"
            class="border-base-content/5 even:bg-base-content/5"
            :class="selected === row.label ? 'bg-primary/10! text-primary' : ''"
            :data-usage-row="row.label"
          >
            <td class="px-4 py-3">
              <button
                class="block w-full cursor-pointer truncate text-left font-mono text-xs hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                :title="row.label || t('hub.unknown')"
                :aria-pressed="selected === row.label"
                @click="emit('select', row.label)"
              >
                {{ row.label || t('hub.unknown') }}
              </button>
              <span
                class="mt-1 block text-[10px] text-base-content/50 tabular-nums sm:hidden"
                >↑ {{ formatBytes(row.upload) }} · ↓
                {{ formatBytes(row.download) }}</span
              >
            </td>
            <td
              class="hidden px-4 py-3 text-right text-xs tabular-nums sm:table-cell"
            >
              {{ formatBytes(row.upload) }}
            </td>
            <td
              class="hidden px-4 py-3 text-right text-xs tabular-nums sm:table-cell"
            >
              {{ formatBytes(row.download) }}
            </td>
            <td
              class="px-4 py-3 text-right text-xs font-bold text-primary tabular-nums"
            >
              {{ formatBytes(row.total) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="!visible.length"
        class="px-4 py-12 text-center text-sm text-base-content/50"
      >
        {{ t('noData') }}
      </p>
    </div>
  </section>
</template>
