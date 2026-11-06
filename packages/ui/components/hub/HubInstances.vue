<script setup lang="ts">
import type { HubInstance } from '~/utils/hub'
const { t } = useI18n()
const hub = useHubStore()
const endpoints = useEndpointStore()
const router = useRouter()
const editing = ref<string | null>(null)
const pendingDelete = ref<string | null>(null)
const history = ref<'retain' | 'purge'>('retain')
const busy = ref(false)
const error = ref('')
const saved = ref(false)
const legacy = ref(false)
const clearSecret = ref(false)
const form = reactive({
  name: '',
  controller_url: '',
  secret: '',
  enabled: true,
  collect_enabled: true,
})
const current = computed(() =>
  hub.instances.find((i) => i.id === editing.value),
)
onMounted(() => {
  legacy.value =
    !!localStorage.getItem('endpointList') &&
    !localStorage.getItem('mihomohub_legacy_notice')
})
function acknowledge(clear: boolean) {
  if (clear) localStorage.removeItem('endpointList')
  localStorage.setItem('mihomohub_legacy_notice', 'true')
  legacy.value = false
}
function reset() {
  clearSecret.value = false
  editing.value = null
  Object.assign(form, {
    name: '',
    controller_url: '',
    secret: '',
    enabled: true,
    collect_enabled: true,
  })
}
function edit(item: HubInstance) {
  clearSecret.value = false
  editing.value = item.id
  Object.assign(form, {
    name: item.name,
    controller_url: '',
    secret: '',
    enabled: item.enabled,
    collect_enabled: item.collect_enabled,
  })
  saved.value = false
}
async function act(action: () => Promise<void>) {
  busy.value = true
  error.value = ''
  saved.value = false
  try {
    await action()
    saved.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('hub.failed')
  } finally {
    busy.value = false
    form.secret = ''
  }
}
function save() {
  const body: Record<string, unknown> = {
    name: form.name,
    enabled: form.enabled,
    collect_enabled: form.collect_enabled,
  }
  if (!editing.value || form.controller_url)
    body.controller_url = form.controller_url
  if (!editing.value || form.secret || clearSecret.value)
    body.secret = clearSecret.value ? '' : form.secret
  return act(async () => {
    await hub.save(editing.value, body)
    reset()
  })
}
function askDelete(id: string) {
  pendingDelete.value = id
  history.value = 'retain'
}
function confirmDelete(item: HubInstance) {
  return act(async () => {
    await hub.remove(item.id, history.value)
    pendingDelete.value = null
    if (editing.value === item.id) reset()
  })
}
function select(item: HubInstance) {
  if (!item.enabled) return
  endpoints.setSelectedEndpoint(item.id)
  router.push('/overview')
}
</script>
<template>
  <main
    class="mx-auto flex h-full w-full max-w-5xl flex-col gap-5 overflow-y-auto p-4 *:shrink-0 sm:p-6"
    data-testid="hub-instances"
  >
    <div>
      <h1 class="text-2xl font-bold">{{ t('hub.instances') }}</h1>
      <p class="mt-2 max-w-3xl text-sm text-base-content/80">
        {{ t('hub.instanceHint') }}
      </p>
    </div>
    <section
      v-if="legacy"
      role="status"
      class="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"
    >
      <p>{{ t('hub.legacy') }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="btn btn-sm" @click="acknowledge(false)">
          {{ t('hub.keepLegacy') }}
        </button>
        <button class="btn btn-outline btn-sm" @click="acknowledge(true)">
          {{ t('hub.clearLegacy') }}
        </button>
      </div>
    </section>
    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
    <p v-if="saved" role="status" class="text-sm text-success">
      {{ t('hub.saved') }}
    </p>
    <section class="rounded-2xl bg-base-200 p-4">
      <h2 class="mb-4 text-lg font-semibold">
        {{ editing ? t('hub.edit') : t('hub.add') }}
      </h2>
      <form
        class="grid gap-4 sm:grid-cols-2"
        method="post"
        @submit.prevent="save"
      >
        <label class="flex flex-col gap-2 text-sm" for="hub-name"
          >{{ t('hub.name') }}
          <input
            id="hub-name"
            v-model="form.name"
            class="input w-full"
            required
            maxlength="128"
            autocomplete="off"
          />
        </label>
        <label class="flex flex-col gap-2 text-sm" for="hub-url"
          >{{ t('hub.url') }}
          <input
            id="hub-url"
            v-model="form.controller_url"
            class="input w-full"
            type="url"
            :required="!editing"
            :placeholder="
              editing ? t('hub.keepValue') : 'http://100.x.x.x:9090'
            "
            autocomplete="off"
          />
        </label>
        <label class="flex flex-col gap-2 text-sm" for="hub-secret"
          >{{ t('hub.secret') }}{{ current?.has_secret ? ' ••••' : '' }}
          <input
            id="hub-secret"
            v-model="form.secret"
            class="input w-full"
            type="password"
            maxlength="4096"
            :placeholder="editing ? t('hub.keepValue') : t('hub.optional')"
            autocomplete="new-password"
          />
        </label>
        <div class="flex flex-wrap items-center gap-5 text-sm">
          <label
            v-if="editing && current?.has_secret"
            class="flex items-center gap-2"
            ><input
              v-model="clearSecret"
              class="checkbox checkbox-sm"
              type="checkbox"
            />{{ t('hub.clearSecret') }}</label
          >
          <label class="flex items-center gap-2"
            ><input
              v-model="form.enabled"
              class="checkbox checkbox-sm"
              type="checkbox"
            />{{ t('hub.enabled') }}</label
          >
          <label class="flex items-center gap-2"
            ><input
              v-model="form.collect_enabled"
              class="checkbox checkbox-sm"
              type="checkbox"
            />{{ t('hub.collect') }}</label
          >
        </div>
        <div class="flex gap-2 sm:col-span-2">
          <Button type="submit" class="btn-primary" :loading="busy">{{
            editing ? t('hub.save') : t('hub.add')
          }}</Button>
          <button
            v-if="editing"
            type="button"
            class="btn btn-ghost"
            :disabled="busy"
            @click="reset"
          >
            {{ t('hub.cancel') }}
          </button>
        </div>
      </form>
    </section>
    <section
      class="divide-y divide-base-content/10 rounded-2xl bg-base-200 px-4"
    >
      <p v-if="!hub.instances.length" class="py-6 text-sm text-base-content/80">
        {{ t('hub.emptyInstances') }}
      </p>
      <article
        v-for="item in hub.instances"
        :key="item.id"
        class="py-4"
        :data-instance="item.id"
      >
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="mr-auto text-left font-semibold hover:text-primary disabled:opacity-60"
            :disabled="!item.enabled"
            @click="select(item)"
          >
            {{ item.name }}
          </button>
          <span
            class="badge badge-outline text-xs"
            :class="
              item.collector_status === 'online'
                ? 'text-success'
                : 'text-base-content'
            "
            >{{ t(`hub.status.${item.collector_status}`) }}</span
          >
          <button
            class="btn btn-ghost btn-sm"
            :disabled="busy"
            @click="edit(item)"
          >
            {{ t('hub.edit') }}
          </button>
          <button
            class="btn btn-ghost btn-sm"
            :disabled="busy"
            @click="act(() => hub.save(item.id, { enabled: !item.enabled }))"
          >
            {{ item.enabled ? t('hub.disable') : t('hub.enable') }}
          </button>
          <button
            class="btn btn-ghost text-error btn-sm"
            :disabled="busy"
            @click="askDelete(item.id)"
          >
            {{ t('hub.delete') }}
          </button>
        </div>
        <p class="mt-2 text-xs text-base-content/80">
          {{ t('hub.lastSeen') }}:
          {{
            item.last_seen_at_ms
              ? new Date(item.last_seen_at_ms).toLocaleString()
              : t('hub.never')
          }}
          · {{ t('hub.collect') }}:
          {{ item.collect_enabled ? t('hub.yes') : t('hub.no') }}
        </p>
        <div
          v-if="pendingDelete === item.id"
          class="mt-3 flex flex-wrap items-center gap-3 border-l-2 border-error pl-3 text-sm"
        >
          <label :for="`history-${item.id}`">{{
            t('hub.deleteHistory')
          }}</label>
          <select
            :id="`history-${item.id}`"
            v-model="history"
            class="select select-sm"
          >
            <option value="retain">{{ t('hub.retain') }}</option>
            <option value="purge">{{ t('hub.purge') }}</option>
          </select>
          <button
            class="btn btn-error btn-sm"
            :disabled="busy"
            @click="confirmDelete(item)"
          >
            {{ t('hub.confirmDelete') }}
          </button>
          <button class="btn btn-ghost btn-sm" @click="pendingDelete = null">
            {{ t('hub.cancel') }}
          </button>
        </div>
      </article>
    </section>
    <NuxtLink to="/traffic" class="pb-4 text-sm text-primary"
      >{{ t('hub.history') }} →</NuxtLink
    >
  </main>
</template>
