<script setup lang="ts">
import { GroupedBar } from '@unovis/ts'
import { VisAxis, VisGroupedBar, VisTooltip, VisXYContainer } from '@unovis/vue'
import type { BegrotingsanalyseChartSpec } from '~/types/begrotingsanalyse-widget'
import { formatMillion } from '~/utils/begrotingsanalyseChart'

const props = defineProps<{
  spec: BegrotingsanalyseChartSpec
  showToolLink?: boolean
}>()

const { conversationId } = useChatStream()

const toolTo = computed(() => {
  const params = props.spec.params
  if (!props.showToolLink || !params?.gemeente || !params.jaar || !params.verslagsoort || !params.circulaire) {
    return ''
  }
  const query = new URLSearchParams({
    gemeente: params.gemeente,
    jaar: params.jaar,
    verslagsoort: params.verslagsoort,
    circulaire: params.circulaire,
    overhead: params.overhead ? '1' : '0'
  })
  if (conversationId.value) {
    query.set('conversation', conversationId.value)
  }
  return `/tools/begrotingsanalyse?${query.toString()}`
})

const colors = ['#2563eb', '#d97706']

interface ChartRow {
  label: string
  values: number[]
}

const rows = computed<ChartRow[]>(() =>
  props.spec.categories.map((label, index) => ({
    label,
    values: props.spec.series.map(entry => Number(entry.values[index] ?? 0))
  }))
)

const yAccessors = computed(() =>
  props.spec.series.map((_entry, seriesIndex) =>
    (row: ChartRow) => row.values[seriesIndex] ?? 0
  )
)

function xAccessor(_row: ChartRow, index: number) {
  return index
}

function colorAccessor(_row: ChartRow, index: number) {
  return colors[index % colors.length]
}

function tickLabel(value: number) {
  const index = Math.round(Number(value))
  return rows.value[index]?.label ?? ''
}

const tooltipTriggers = {
  [GroupedBar.selectors.bar]: (row: ChartRow) => {
    const lines = props.spec.series.map((entry, index) =>
      `${entry.name}: ${formatMillion(row.values[index] ?? 0)}`
    )
    return `<div><strong>${row.label}</strong><br>${lines.join('<br>')}</div>`
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-default bg-elevated/40">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-default px-4 py-3">
      <div>
        <p class="font-medium text-highlighted">
          {{ spec.name }}
        </p>
        <p class="text-xs text-muted">
          {{ spec.unit }}
        </p>
      </div>

      <UButton
        v-if="toolTo"
        :to="toolTo"
        icon="i-lucide-sliders-horizontal"
        label="Open in de tool"
      />
    </div>

    <div class="space-y-3 px-4 py-4">
      <div class="flex flex-wrap gap-3 text-xs text-muted">
        <span
          v-for="(entry, index) in spec.series"
          :key="entry.name"
          class="inline-flex items-center gap-1.5"
        >
          <span
            class="inline-block size-2.5 rounded-sm"
            :style="{ backgroundColor: colors[index % colors.length] }"
          />
          {{ entry.name }}
        </span>
      </div>

      <ClientOnly>
        <VisXYContainer
          :data="rows"
          :height="320"
          class="begrotingsanalyse-chart"
        >
          <VisGroupedBar
            :x="xAccessor"
            :y="yAccessors"
            :color="colorAccessor"
            :bar-padding="0.15"
            :group-padding="0.25"
          />
          <VisAxis
            type="x"
            :tick-format="tickLabel"
            :num-ticks="rows.length"
          />
          <VisAxis
            type="y"
            :tick-format="formatMillion"
          />
          <VisTooltip :triggers="tooltipTriggers" />
        </VisXYContainer>
      </ClientOnly>

      <p
        v-if="spec.legend"
        class="text-xs text-muted"
      >
        {{ spec.legend }}
      </p>
    </div>
  </div>
</template>
