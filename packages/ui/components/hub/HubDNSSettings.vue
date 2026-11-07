<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useHubDNS } from '~/composables/useHubDNS'
import { hubErrorKey } from '~/utils/hub'

const props = defineProps<{ instanceId: string }>()
const { t } = useI18n()
const state = useHubDNS(props.instanceId)
const fileInput = ref<HTMLInputElement>()
const localError = ref('')
const disabled = computed(
  () => state.busy.value || state.loading.value || !state.view.value?.imported,
)
onMounted(state.load)

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  localError.value = ''
  if (file.size > 512 * 1024) {
    localError.value = t('hub.dns.fileTooLarge')
    return
  }
  try {
    if (await state.importYAML(await file.text()))
      toast.success(t('hub.dns.imported'))
  } catch {
    localError.value = t('hub.dns.fileReadFailed')
  }
}
async function apply() {
  localError.value = ''
  if (await state.apply()) toast.success(t('hub.dns.applied'))
}
</script>

<template>
  <section
    class="config-card col-span-1 lg:col-span-2"
    data-testid="hub-dns-settings"
    :aria-busy="state.busy.value || state.loading.value"
  >
    <h2
      class="border-b border-base-content/5 bg-base-300/30 px-4 py-3 text-sm font-semibold"
    >
      {{ t('dnsSettings') }}
    </h2>
    <div class="flex flex-col gap-4 p-4">
      <p class="text-sm leading-relaxed opacity-70">{{ t('hub.dns.note') }}</p>
      <p class="text-xs opacity-60">{{ t('hub.dns.runtimeOnly') }}</p>
      <div class="flex flex-wrap items-center gap-3">
        <input
          ref="fileInput"
          data-testid="hub-dns-yaml"
          type="file"
          accept=".yaml,.yml,text/yaml,application/yaml"
          class="hidden"
          :aria-label="t('hub.dns.import')"
          @change="importFile"
        />
        <Button
          class="btn-outline btn-sm"
          :disabled="
            state.busy.value || state.loading.value || !state.view.value
          "
          @click="fileInput?.click()"
          >{{ t('hub.dns.import') }}</Button
        >
        <Button
          class="btn-ghost btn-sm"
          :disabled="state.busy.value || state.loading.value"
          @click="state.load"
          >{{ t('hub.refresh') }}</Button
        >
        <span class="text-xs opacity-60">{{
          state.view.value?.imported
            ? t('hub.dns.ready')
            : t('hub.dns.required')
        }}</span>
      </div>
      <p
        v-if="state.error.value || localError"
        role="alert"
        class="text-sm text-error"
      >
        {{ localError || t(hubErrorKey(state.error.value)) }}
      </p>
      <fieldset :disabled="disabled" class="flex flex-col gap-3">
        <label
          class="flex items-center justify-between gap-4 text-sm"
          for="hub-dns-enable"
          >{{ t('hub.dns.enable')
          }}<input
            id="hub-dns-enable"
            v-model="state.form.enable"
            class="toggle toggle-primary"
            type="checkbox"
        /></label>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex flex-col gap-2 text-xs" for="hub-dns-listen"
            >{{ t('hub.dns.listen')
            }}<input
              id="hub-dns-listen"
              v-model="state.form.listen"
              class="input-bordered input w-full font-mono text-sm"
              placeholder="127.0.0.1:1053"
          /></label>
          <label class="flex flex-col gap-2 text-xs" for="hub-dns-mode"
            >{{ t('dnsEnhancedMode')
            }}<select
              id="hub-dns-mode"
              v-model="state.form.enhancedMode"
              class="select-bordered select w-full"
            >
              <option value="fake-ip">fake-ip</option>
              <option value="redir-host">redir-host</option>
            </select></label
          >
          <label class="flex flex-col gap-2 text-xs" for="hub-dns-nameserver"
            >{{ t('dnsNameserver')
            }}<textarea
              id="hub-dns-nameserver"
              v-model="state.form.nameserver"
              class="textarea-bordered textarea w-full font-mono"
              rows="4"
            />
          </label>
          <label class="flex flex-col gap-2 text-xs" for="hub-dns-fallback"
            >{{ t('dnsFallback')
            }}<textarea
              id="hub-dns-fallback"
              v-model="state.form.fallback"
              class="textarea-bordered textarea w-full font-mono"
              rows="4"
            />
          </label>
          <label class="flex flex-col gap-2 text-xs" for="hub-dns-range"
            >{{ t('dnsFakeIpRange')
            }}<input
              id="hub-dns-range"
              v-model="state.form.fakeIPRange"
              class="input-bordered input w-full font-mono text-sm"
              placeholder="198.18.0.1/16"
          /></label>
        </div>
        <label
          class="flex items-center justify-between gap-4 text-sm"
          for="hub-dns-hosts"
          >{{ t('dnsUseHosts')
          }}<input
            id="hub-dns-hosts"
            v-model="state.form.useHosts"
            class="toggle toggle-primary"
            type="checkbox"
        /></label>
        <Button
          class="self-start btn-primary"
          :loading="state.busy.value"
          :disabled="disabled"
          @click="apply"
          >{{ t('hub.dns.apply') }}</Button
        >
      </fieldset>
    </div>
  </section>
</template>
