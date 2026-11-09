<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

useHead({
  titleTemplate: (title) => (title ? `${title} - MetaCubeXD` : 'MetaCubeXD'),
})

const configStore = useConfigStore()
const hubMode = useRuntimeConfig().public.mihomoHub
const endpointStore = hubMode ? useEndpointStore() : undefined
const pageKey = computed(() => {
  if (!hubMode) return undefined
  const endpointId = endpointStore?.selectedEndpoint
  // 使用 NuxtPage 传入的目标路由；useRoute() 要等页面完成后才同步，
  // 用它生成 key 会在导航中再次重建页面，导致菜单高亮滞后和内容闪空。
  // 实例仍参与 key，同页切换实例时继续重建表单和图表的局部状态。
  return (targetRoute: RouteLocationNormalizedLoaded) =>
    `${targetRoute.path}:${endpointId}`
})

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
