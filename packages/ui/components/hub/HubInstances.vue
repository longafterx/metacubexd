<script setup lang="ts">
import type { HubInstance } from '~/utils/hub'
import type { HubControllerProtocol } from '~/utils/hubController'
import {
  IconEdit,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconServer,
  IconTrash,
} from '@tabler/icons-vue'
import { hubErrorKey, hubRequest } from '~/utils/hub'
import { hubControllerURL, splitHubControllerURL } from '~/utils/hubController'

const { t } = useI18n()
const hub = useHubStore()
const endpoints = useEndpointStore()
const router = useRouter()
const editor = ref<{ open: () => void; close: (force?: boolean) => void }>()
const deletion = ref<{ open: () => void; close: (force?: boolean) => void }>()
const editing = ref<HubInstance | null>(null)
const pendingDelete = ref<HubInstance | null>(null)
const history = ref<'retain' | 'purge'>('retain')
const busy = ref(false)
const testing = ref(false)
const loadingConfig = ref(false)
const refreshing = ref(false)
const error = ref('')
const editorError = ref('')
const deleteError = ref('')
const notice = ref('')
const legacy = ref(false)
const originalURL = ref('')
const protocol = ref<HubControllerProtocol>('http:')
const secretAction = ref<'keep' | 'replace' | 'none'>('none')
const connection = ref<{ ok: boolean; message: string } | null>(null)
let configRequest: AbortController | undefined
const form = reactive({
  name: '',
  controller_host: '',
  controller_port: '9090' as string | number,
  secret: '',
})
const controllerURL = computed(() =>
  hubControllerURL(form.controller_host, form.controller_port, protocol.value),
)
const locked = computed(() => busy.value || testing.value)
const editorTitle = computed(() =>
  editing.value
    ? `${t('hub.editInstance')} · ${editing.value.name}`
    : t('hub.add'),
)

onMounted(() => {
  legacy.value =
    !!localStorage.getItem('endpointList') &&
    !localStorage.getItem('mihomohub_legacy_notice')
})
onBeforeUnmount(() => configRequest?.abort())
// 连接参数改变后，旧的测试结果不再代表当前表单；密钥仅保存在弹窗的临时内存里。
watch(
  () => [
    form.controller_host,
    form.controller_port,
    protocol.value,
    form.secret,
    secretAction.value,
  ],
  () => {
    connection.value = null
  },
)
function acknowledge(clear: boolean) {
  if (clear) localStorage.removeItem('endpointList')
  localStorage.setItem('mihomohub_legacy_notice', 'true')
  legacy.value = false
}
function clearEditor() {
  configRequest?.abort()
  configRequest = undefined
  editing.value = null
  loadingConfig.value = false
  editorError.value = ''
  originalURL.value = ''
  protocol.value = 'http:'
  secretAction.value = 'none'
  connection.value = null
  Object.assign(form, {
    name: '',
    controller_host: '',
    controller_port: '9090',
    secret: '',
  })
}
function add() {
  clearEditor()
  editor.value?.open()
}
async function loadConfig() {
  const item = editing.value
  if (!item) return
  configRequest?.abort()
  const request = new AbortController()
  configRequest = request
  loadingConfig.value = true
  editorError.value = ''
  try {
    const { data } = await hubRequest<{ controller_url: string }>(
      `/api/v1/instances/${item.id}/config`,
      { signal: request.signal },
    )
    if (request.signal.aborted) return
    const address = splitHubControllerURL(data.controller_url)
    form.controller_host = address.host
    form.controller_port = address.port
    protocol.value = address.protocol
    originalURL.value = hubControllerURL(
      address.host,
      address.port,
      address.protocol,
    )
  } catch (e) {
    if (!request.signal.aborted) editorError.value = t(hubErrorKey(e))
  } finally {
    if (!request.signal.aborted) loadingConfig.value = false
  }
}
function edit(item: HubInstance) {
  clearEditor()
  editing.value = { ...item }
  Object.assign(form, {
    name: item.name,
  })
  secretAction.value = item.has_secret ? 'keep' : 'none'
  editor.value?.open()
  void loadConfig()
}
function credentials() {
  const body: Record<string, unknown> = {
    controller_url: controllerURL.value,
  }
  if (secretAction.value === 'replace') body.secret = form.secret
  // 无密钥实例的普通编辑省略 Secret，避免仅改名也触发连接配置的 DNS 校验。
  else if (
    secretAction.value === 'none' &&
    (!editing.value || editing.value.has_secret)
  )
    body.secret = ''
  return body
}
async function probe() {
  if (!controllerURL.value) {
    editorError.value = t('hub.errors.invalidAddress')
    return false
  }
  testing.value = true
  connection.value = null
  try {
    const { data } = await hubRequest<{ version: string }>(
      '/api/v1/instances/test',
      {
        method: 'POST',
        body: {
          ...credentials(),
          ...(editing.value ? { instance_id: editing.value.id } : {}),
        },
      },
    )
    connection.value = {
      ok: true,
      message: t('hub.testSuccess', { version: data.version }),
    }
    return true
  } catch (e) {
    connection.value = {
      ok: false,
      message: `${t('hub.testFailedUnsaved')} ${t(hubErrorKey(e))}`,
    }
    return false
  } finally {
    testing.value = false
  }
}
async function save() {
  if (locked.value || loadingConfig.value) return
  editorError.value = ''
  if (!controllerURL.value) {
    editorError.value = t('hub.errors.invalidAddress')
    return
  }
  busy.value = true
  try {
    // 接入即由 Hub 管理并采集；新增前先验证连接，失败时不创建记录。
    if (!editing.value && !connection.value?.ok && !(await probe())) return
    const body: Record<string, unknown> = {
      ...credentials(),
      name: form.name.trim(),
    }
    if (editing.value && body.controller_url === originalURL.value)
      delete body.controller_url
    await hub.save(editing.value?.id ?? null, body)
    notice.value = t(editing.value ? 'hub.updated' : 'hub.created', {
      name: form.name.trim(),
    })
    editor.value?.close(true)
  } catch (e) {
    editorError.value = t(hubErrorKey(e))
  } finally {
    busy.value = false
  }
}
async function refresh() {
  refreshing.value = true
  error.value = ''
  try {
    await hub.refresh(true)
  } catch (e) {
    error.value = t(hubErrorKey(e))
  } finally {
    refreshing.value = false
  }
}
function askDelete(item: HubInstance) {
  pendingDelete.value = item
  history.value = 'retain'
  deleteError.value = ''
  deletion.value?.open()
}
async function confirmDelete() {
  if (!pendingDelete.value || busy.value) return
  busy.value = true
  try {
    await hub.remove(pendingDelete.value.id, history.value)
    notice.value = t(
      history.value === 'retain' ? 'hub.deletedRetained' : 'hub.deletedPurged',
    )
    deletion.value?.close(true)
  } catch (e) {
    deleteError.value = t(hubErrorKey(e))
  } finally {
    busy.value = false
  }
}
function select(item: HubInstance) {
  endpoints.setSelectedEndpoint(item.id)
  router.push('/overview')
}
</script>

<template>
  <main
    class="mx-auto flex h-full w-full max-w-5xl flex-col gap-5 overflow-y-auto p-4 *:shrink-0 sm:p-6"
    data-testid="hub-instances"
  >
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          {{ t('hub.instances') }}
          <span class="ml-1 text-lg font-normal text-base-content/50">{{
            hub.instances.length
          }}</span>
        </h1>
        <p class="mt-2 max-w-2xl text-sm text-base-content/70">
          {{ t('hub.instanceHint') }}
        </p>
      </div>
      <div class="flex gap-2">
        <Button class="btn-ghost btn-sm" :loading="refreshing" @click="refresh"
          ><IconRefresh :size="16" />{{ t('hub.refresh') }}</Button
        >
        <Button class="btn-primary btn-sm" :disabled="locked" @click="add"
          ><IconPlus :size="16" />{{ t('hub.add') }}</Button
        >
      </div>
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
    <p
      v-if="notice"
      role="status"
      class="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success"
    >
      {{ notice }}
    </p>
    <section
      class="divide-y divide-base-content/10 overflow-hidden rounded-2xl border border-base-content/10 bg-base-200"
    >
      <div
        v-if="!hub.instances.length"
        class="flex flex-col items-center gap-4 px-6 py-12 text-center"
      >
        <IconServer :size="32" class="text-base-content/40" />
        <p class="text-sm text-base-content/70">
          {{ t('hub.emptyInstances') }}
        </p>
        <button class="btn btn-outline btn-sm" @click="add">
          {{ t('hub.add') }}
        </button>
      </div>
      <article
        v-for="item in hub.instances"
        :key="item.id"
        class="p-4 sm:p-5"
        :data-instance="item.id"
      >
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-100 text-primary"
            ><IconServer :size="21"
          /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-semibold break-all">{{ item.name }}</h2>
              <span
                v-if="endpoints.selectedEndpoint === item.id"
                class="badge badge-outline badge-sm badge-primary"
                >{{ t('hub.current') }}</span
              >
            </div>
            <p class="mt-1 text-xs text-base-content/60">
              {{ item.has_secret ? t('hub.secretStored') : t('hub.noSecret') }}
              · {{ t('hub.managed') }}
            </p>
          </div>
          <span
            class="badge badge-outline badge-sm"
            :class="
              item.collector_status === 'online'
                ? 'text-success'
                : 'text-base-content/70'
            "
            >{{ t(`hub.status.${item.collector_status}`) }}</span
          >
        </div>
        <div
          class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-base-content/5 pt-3"
        >
          <p class="text-xs text-base-content/60">
            {{ t('hub.lastSeen') }}:
            {{
              item.last_seen_at_ms
                ? new Date(item.last_seen_at_ms).toLocaleString()
                : t('hub.never')
            }}
          </p>
          <div class="flex flex-wrap gap-1">
            <button
              class="btn btn-ghost btn-sm"
              :disabled="locked"
              @click="select(item)"
            >
              <IconExternalLink :size="15" />{{ t('hub.openDashboard') }}
            </button>
            <button
              class="btn btn-ghost btn-sm"
              :disabled="locked"
              @click="edit(item)"
            >
              <IconEdit :size="15" />{{ t('hub.edit') }}
            </button>
            <button
              class="btn btn-ghost text-error btn-sm"
              :disabled="locked"
              @click="askDelete(item)"
            >
              <IconTrash :size="15" />{{ t('hub.delete') }}
            </button>
          </div>
        </div>
      </article>
    </section>
    <NuxtLink to="/traffic" class="pb-4 text-sm text-primary"
      >{{ t('dataUsage') }} →</NuxtLink
    >

    <Modal
      ref="editor"
      :title="editorTitle"
      :before-close="() => !locked"
      @close="clearEditor"
    >
      <template #icon><IconServer :size="22" /></template>
      <p
        v-if="loadingConfig"
        role="status"
        class="mb-4 text-sm text-base-content/60"
      >
        {{ t('hub.loadingConfig') }}
      </p>
      <div v-if="editorError" role="alert" class="mb-4 text-sm text-error">
        {{ editorError }}
        <button
          v-if="editing && !originalURL"
          class="btn ml-2 btn-ghost btn-xs"
          @click="loadConfig"
        >
          {{ t('hub.retry') }}
        </button>
      </div>
      <form id="hub-instance-form" method="post" @submit.prevent="save">
        <fieldset
          :disabled="locked || loadingConfig || !!(editing && !originalURL)"
          class="flex flex-col gap-5"
        >
          <label for="hub-name" class="flex flex-col gap-2 text-sm font-medium"
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
          <div class="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <label
              for="hub-host"
              class="flex min-w-0 flex-col gap-2 text-sm font-medium"
              >{{ t('hub.controllerHost') }}
              <input
                id="hub-host"
                v-model="form.controller_host"
                class="input w-full font-mono text-sm"
                required
                placeholder="100.111.37.112"
                autocomplete="off"
                spellcheck="false"
              />
            </label>
            <label
              for="hub-port"
              class="flex flex-col gap-2 text-sm font-medium"
              >{{ t('hub.controllerPort') }}
              <input
                id="hub-port"
                v-model="form.controller_port"
                class="input w-full font-mono text-sm"
                type="number"
                min="1"
                max="65535"
                step="1"
                required
                placeholder="9090"
                autocomplete="off"
              />
            </label>
            <p class="col-span-2 text-xs font-normal text-base-content/60">
              {{ t('hub.controllerAddressHint') }}
            </p>
          </div>
          <div class="flex flex-col gap-2 text-sm">
            <label for="hub-secret-action" class="font-medium">{{
              t('hub.secret')
            }}</label>
            <select
              id="hub-secret-action"
              v-model="secretAction"
              class="select w-full"
            >
              <option v-if="editing?.has_secret" value="keep">
                {{ t('hub.keepSecret') }}
              </option>
              <option value="none">
                {{
                  editing?.has_secret ? t('hub.clearSecret') : t('hub.noSecret')
                }}
              </option>
              <option value="replace">{{ t('hub.setSecret') }}</option>
            </select>
            <input
              v-if="secretAction === 'replace'"
              id="hub-secret"
              v-model="form.secret"
              :aria-label="t('hub.newSecret')"
              class="input w-full"
              type="password"
              required
              maxlength="4096"
              autocomplete="new-password"
              :placeholder="t('hub.newSecret')"
            />
            <p class="text-xs text-base-content/60">
              {{ t('hub.secretHint') }}
            </p>
          </div>
          <p
            class="rounded-xl border border-base-content/10 bg-base-200 p-4 text-sm leading-relaxed text-base-content/70"
          >
            {{ t('hub.managedHint') }}
          </p>
        </fieldset>
      </form>
      <p
        v-if="connection"
        :role="connection.ok ? 'status' : 'alert'"
        class="mt-4 rounded-xl border p-3 text-sm"
        :class="
          connection.ok
            ? 'border-success/20 bg-success/5 text-success'
            : 'border-error/20 bg-error/5 text-error'
        "
      >
        {{ connection.message }}
      </p>
      <template #actions>
        <Button
          class="btn-ghost btn-sm"
          :disabled="locked"
          @click="editor?.close()"
          >{{ t('hub.cancel') }}</Button
        >
        <Button
          class="btn-outline btn-sm"
          :loading="testing"
          :disabled="
            busy ||
            loadingConfig ||
            !controllerURL ||
            (secretAction === 'replace' && !form.secret)
          "
          @click="probe"
          >{{ t('hub.testConnection') }}</Button
        >
        <Button
          type="submit"
          form="hub-instance-form"
          class="btn-primary btn-sm"
          :loading="busy"
          :disabled="testing || loadingConfig || !!(editing && !originalURL)"
          >{{ editing ? t('hub.save') : t('hub.testAndAdd') }}</Button
        >
      </template>
    </Modal>
    <Modal
      ref="deletion"
      :title="t('hub.deleteInstance')"
      :before-close="() => !busy"
      @close="pendingDelete = null"
    >
      <p class="mb-5 text-sm">
        {{ t('hub.deletePrompt', { name: pendingDelete?.name }) }}
      </p>
      <fieldset :disabled="busy" class="flex flex-col gap-3">
        <label
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-base-content/15 p-4"
          :class="history === 'retain' ? 'border-primary bg-primary/5' : ''"
        >
          <input
            v-model="history"
            type="radio"
            name="hub-delete-history"
            value="retain"
            class="radio radio-sm radio-primary"
          />
          <span
            ><strong class="text-sm">{{ t('hub.retain') }}</strong
            ><span
              class="mt-1 block text-xs leading-relaxed text-base-content/65"
              >{{ t('hub.retainHint') }}</span
            ></span
          >
        </label>
        <label
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-base-content/15 p-4"
          :class="history === 'purge' ? 'border-error bg-error/5' : ''"
        >
          <input
            v-model="history"
            type="radio"
            name="hub-delete-history"
            value="purge"
            class="radio radio-sm radio-error"
          />
          <span
            ><strong class="text-sm text-error">{{ t('hub.purge') }}</strong
            ><span
              class="mt-1 block text-xs leading-relaxed text-base-content/65"
              >{{ t('hub.purgeHint') }}</span
            ></span
          >
        </label>
      </fieldset>
      <p v-if="deleteError" role="alert" class="mt-4 text-sm text-error">
        {{ deleteError }}
      </p>
      <template #actions>
        <Button
          class="btn-ghost btn-sm"
          :disabled="busy"
          @click="deletion?.close()"
          >{{ t('hub.cancel') }}</Button
        >
        <Button
          class="btn-error btn-sm"
          :loading="busy"
          @click="confirmDelete"
          >{{ t('hub.confirmDelete') }}</Button
        >
      </template>
    </Modal>
  </main>
</template>
