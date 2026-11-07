<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

useHead({
  titleTemplate: (title) => (title ? `${title} - MetaCubeXD` : 'MetaCubeXD'),
})

const configStore = useConfigStore()
const hubMode = useRuntimeConfig().public.mihomoHub
const endpointStore = hubMode ? useEndpointStore() : undefined
const route = useRoute()
// 切换实例重新建立当前页面，清空表单和图表的局部状态；不重新加载整个应用。
const pageKey = computed(() =>
  hubMode ? `${route.path}:${endpointStore?.selectedEndpoint}` : undefined,
)

// vue-sonner defaults to a light theme, but the app default theme is dark, so an
// unbound toaster ships bright cards over a dark UI. Derive the toaster theme
// from the active daisyUI theme's color-scheme (daisyUI v5 emits it per theme).
//
// This must be a ref re-read AFTER the DOM updates, not a plain computed: the
// layout (which applies `data-theme` to <html>) is rendered behind an async
// Suspense boundary, so on first paint the Toaster can evaluate before
// `data-theme` exists — getComputedStyle then returns the default light scheme
// and a computed would cache that stale value forever (curTheme never changes
// again after hydration). nextTick + onMounted re-read once the scheme settles.
const toasterTheme = ref<'light' | 'dark'>('dark')
const syncToasterTheme = () => {
  if (typeof document === 'undefined') return
  const scheme = getComputedStyle(document.documentElement).colorScheme
  toasterTheme.value = scheme.includes('light') ? 'light' : 'dark'
}
watch(
  () => configStore.curTheme,
  () => nextTick(syncToasterTheme),
  {
    immediate: true,
  },
)
onMounted(() => nextTick(syncToasterTheme))
</script>

<template>
  <NuxtLayout>
    <NuxtPage
      :page-key="pageKey"
      :transition="{
        name: 'page',
        mode: 'out-in',
      }"
    />
  </NuxtLayout>

  <PwaUpdatePrompt />

  <!-- vue-sonner toast outlet (desktop control surface uses toasts). Top-center
       keeps clear of the bottom-right traffic widget + the mobile bottom nav;
       theme is bound to the active daisyUI theme. -->
  <Toaster position="top-center" :theme="toasterTheme" rich-colors />
</template>
