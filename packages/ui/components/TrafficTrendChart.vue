<script setup lang="ts">
import type Highcharts from 'highcharts'
import { loadHighcharts } from '~/composables/useHighcharts'
import { formatBytes, getChartThemeColors } from '~/utils'

interface TrendPoint {
  timestamp: number
  upload: number | null
  download: number | null
}

const props = defineProps<{
  data: TrendPoint[]
  startTime: number
  endTime: number
  isLoading?: boolean
  title?: string
}>()

const { t, locale } = useI18n()
const configStore = useConfigStore()
const containerRef = ref<HTMLDivElement>()
let chart: Highcharts.Chart | undefined
let hc: typeof Highcharts | undefined
let resizeObserver: ResizeObserver | undefined

// 未观测桶保持断点；孤立的有效桶用小圆点表示，避免新实例已有流量却显示空图。
const seriesData = (field: 'upload' | 'download') =>
  props.data.map((point, index) => ({
    x: point.timestamp,
    y: point[field],
    marker: {
      enabled:
        point[field] != null &&
        props.data[index - 1]?.[field] == null &&
        props.data[index + 1]?.[field] == null,
      radius: 2,
    },
  }))

const initChart = () => {
  if (!containerRef.value || !hc) return
  const themeColors = getChartThemeColors()

  chart = hc.chart(containerRef.value, {
    chart: {
      type: 'areaspline',
      backgroundColor: 'transparent',
      animation: false,
    },
    title: { text: undefined },
    credits: { enabled: false },
    accessibility: { enabled: false },
    xAxis: {
      type: 'datetime',
      min: props.startTime,
      max: props.endTime,
      labels: { style: { color: themeColors.textColor } },
      lineColor: themeColors.lineColor,
      tickColor: themeColors.tickColor,
    },
    yAxis: {
      title: { text: undefined },
      labels: {
        style: { color: themeColors.textColor },
        formatter() {
          return formatBytes(this.value as number)
        },
      },
      gridLineColor: themeColors.gridLineColor,
      min: 0,
    },
    legend: { itemStyle: { color: themeColors.textColor } },
    tooltip: {
      shared: true,
      formatter() {
        const time = hc!.dateFormat('%Y-%m-%d %H:%M', this.x as number)
        let html = `<b>${time}</b><br/>`
        this.points?.forEach((p) => {
          html += `<span style="color:${p.color}">\u25CF</span> ${p.series.name}: <b>${formatBytes(p.y as number)}</b><br/>`
        })
        return html
      },
    },
    plotOptions: {
      series: { animation: false },
      areaspline: {
        fillOpacity: 0.15,
        marker: { enabled: false },
        lineWidth: 1.5,
      },
    },
    series: [
      {
        type: 'areaspline',
        name: t('upload'),
        data: seriesData('upload'),
        color: themeColors.seriesColors[0],
      },
      {
        type: 'areaspline',
        name: t('download'),
        data: seriesData('download'),
        color: themeColors.seriesColors[1],
      },
    ],
  })
}

const updateData = () => {
  if (!chart) return
  const uploadSeries = seriesData('upload')
  const downloadSeries = seriesData('download')
  chart.series[0]?.setData(uploadSeries, false)
  chart.series[1]?.setData(downloadSeries, false)
  chart.xAxis[0]?.update(
    {
      min: props.startTime,
      max: props.endTime,
    },
    false,
  )
  // 先同步坐标范围再重绘，避免稀疏数据从空轴范围动画到远离画布的位置。
  chart.redraw(false)
}

watch(() => props.data, updateData, { deep: true })
watch([() => props.startTime, () => props.endTime], () => {
  if (chart) {
    chart.xAxis[0]?.update({ min: props.startTime, max: props.endTime }, true)
  }
})

watch(
  () => configStore.curTheme,
  () => {
    if (chart) {
      const themeColors = getChartThemeColors()
      chart.update({
        xAxis: {
          labels: { style: { color: themeColors.textColor } },
          lineColor: themeColors.lineColor,
        },
        yAxis: {
          labels: { style: { color: themeColors.textColor } },
          gridLineColor: themeColors.gridLineColor,
        },
        legend: { itemStyle: { color: themeColors.textColor } },
      })
    }
  },
)

watch(locale, () => {
  if (chart) {
    chart.series[0]?.update({ type: 'areaspline', name: t('upload') }, false)
    chart.series[1]?.update({ type: 'areaspline', name: t('download') }, true)
  }
})

onMounted(async () => {
  hc = await loadHighcharts()
  initChart()
  resizeObserver = new ResizeObserver(() => {
    if (chart && containerRef.value) {
      chart.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
        false,
      )
    }
  })
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  chart?.destroy()
  chart = undefined
})
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <div v-if="title" class="flex items-center justify-center gap-2 px-4 py-2">
      <h3 class="text-lg font-bold tracking-wider text-base-content uppercase">
        {{ title }}
      </h3>
    </div>
    <div
      ref="containerRef"
      class="min-h-0 w-full flex-1 transition-opacity"
      :class="{ 'opacity-50': isLoading }"
    />
  </div>
</template>
