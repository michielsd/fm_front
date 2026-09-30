<script setup lang="ts">
import type { ChatWidgetSpec } from '~/types/chat'
import { isBegrotingsanalyseChartSpec } from '~/utils/begrotingsanalyseChart'
import { isFinancialPositionWidgetSpec } from '~/utils/financialPosition'
import { isKengetallenWidgetSpec } from '~/utils/kengetallenChart'
import { isDataTableWidgetSpec } from '~/utils/dataTable'

defineProps<{
  widget: ChatWidgetSpec
}>()
</script>

<template>
  <Suspense v-if="isFinancialPositionWidgetSpec(widget)">
    <LazyChatFinancialPositionWidget :spec="widget" />
    <template #fallback>
      <ChatTableWidgetSkeleton name="Financiële positie" />
    </template>
  </Suspense>
  <Suspense v-else-if="isKengetallenWidgetSpec(widget)">
    <LazyChatKengetallenWidget :initial-spec="widget" />
    <template #fallback>
      <ChatKengetallenWidgetSkeleton
        :kengetal="widget.kengetal"
        :gemeente-naam="widget.gemeente_naam"
      />
    </template>
  </Suspense>
  <Suspense v-else-if="isBegrotingsanalyseChartSpec(widget)">
    <LazyChatBegrotingsanalyseWidget
      :spec="widget"
      show-tool-link
    />
    <template #fallback>
      <ChatTableWidgetSkeleton :name="widget.name" />
    </template>
  </Suspense>
  <Suspense v-else-if="isDataTableWidgetSpec(widget)">
    <LazyChatTableWidget :initial-spec="widget" />
    <template #fallback>
      <ChatTableWidgetSkeleton :name="widget.name" />
    </template>
  </Suspense>
</template>
