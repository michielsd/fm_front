<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { SelectorOptions } from '~/types/selectors'
import type { DataViewerFilters, DataViewerLimit } from '~/composables/useDataViewer'

const LIMIT_OPTIONS: { label: string, value: DataViewerLimit }[] = [
  { label: '10', value: '10' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
  { label: '100', value: '100' },
  { label: '250', value: '250' },
  { label: '500', value: '500' }
]

const selectorValues = ref<DataViewerFilters>({
  limit: '10'
})
const selectorsInitialized = ref(false)

const filters = computed<DataViewerFilters>(() => ({
  model: selectorValues.value.model,
  circulaire: selectorValues.value.circulaire,
  jaar: selectorValues.value.jaar,
  limit: selectorValues.value.limit ?? '10'
}))

const { selectors, rows, totalCount, limit, modelMeta, pending, error, refresh } = useDataViewer(filters)

const selectorEntries = computed(() => {
  const entries = Object.entries(selectors.value).map(([field, definition]) => ({
    field,
    label: definition.label ?? field,
    options: definition.options
  }))

  if (modelMeta.value.has_circulaire) {
    return entries
  }

  return entries.filter(entry => entry.field !== 'circulaire')
})

watch(
  selectors,
  (nextSelectors) => {
    if (!nextSelectors.model?.options) {
      return
    }

    if (!selectorsInitialized.value) {
      const defaults: DataViewerFilters = { limit: '10' }
      for (const [field, definition] of Object.entries(nextSelectors)) {
        if (field === 'limit') {
          continue
        }
        const entries = Object.entries(definition.options)
        if (entries.length === 0) {
          continue
        }
        const firstValue = entries[0]?.[1]
        if (firstValue) {
          defaults[field as Exclude<keyof DataViewerFilters, 'limit'>] = firstValue
        }
      }
      selectorValues.value = defaults
      selectorsInitialized.value = true
      return
    }

    const next = { ...selectorValues.value }
    let changed = false
    for (const [field, definition] of Object.entries(nextSelectors)) {
      if (field === 'limit') {
        continue
      }
      const key = field as Exclude<keyof DataViewerFilters, 'limit'>
      const current = next[key]
      const validValues = Object.values(definition.options)
      if (validValues.length === 0) {
        continue
      }
      if (!current || !validValues.includes(current)) {
        next[key] = validValues[0]
        changed = true
      }
    }
    if (changed) {
      selectorValues.value = next
    }
  },
  { immediate: true, deep: true }
)

function buildSelectorItems(options: SelectorOptions) {
  return Object.entries(options).map(([label, value]) => ({ label, value }))
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

const columns = computed<TableColumn<Record<string, unknown>>[]>(() => {
  if (rows.value.length === 0) {
    return []
  }

  const keys = new Set<string>()
  for (const row of rows.value) {
    for (const key of Object.keys(row)) {
      keys.add(key)
    }
  }

  return [...keys].map(key => ({
    accessorKey: key,
    header: key,
    cell: ({ row }) => formatCellValue(row.getValue(key))
  }))
})

const showingSummary = computed(() => {
  const shown = rows.value.length
  const total = totalCount.value
  if (total === 0) {
    return 'No records'
  }
  if (shown >= total) {
    return `${total} record${total === 1 ? '' : 's'}`
  }
  return `Showing ${shown} of ${total} records`
})

useSeoMeta({
  title: 'Data viewer',
  description: 'Browse raw dataserve model records.'
})
</script>

<template>
  <UPage>
    <UPageHeader
      title="Data viewer"
      description="Inspect records from dataserve models."
    >
      <template #links>
        <UButton
          icon="i-lucide-refresh-cw"
          label="Refresh"
          color="neutral"
          variant="outline"
          :loading="pending"
          @click="refresh()"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <div class="w-full">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Failed to load data"
          :description="error.message"
          class="mb-6"
        />

        <div
          v-if="pending && rows.length === 0 && !selectorValues.model"
          class="flex items-center justify-center py-16 text-muted"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-6 animate-spin"
          />
        </div>

        <div
          v-else
          class="space-y-4"
        >
          <div class="flex flex-wrap gap-4">
            <UFormField
              v-for="selector in selectorEntries"
              :key="selector.field"
              :label="selector.label"
              class="min-w-48 max-w-xs flex-1"
            >
              <USelect
                v-model="selectorValues[selector.field as keyof DataViewerFilters]"
                :items="buildSelectorItems(selector.options)"
                value-key="value"
                label-key="label"
              />
            </UFormField>

            <UFormField
              label="Records shown"
              class="min-w-36 max-w-xs"
            >
              <USelect
                v-model="selectorValues.limit"
                :items="[...LIMIT_OPTIONS]"
                value-key="value"
                label-key="label"
              />
            </UFormField>
          </div>

          <UEmpty
            v-if="!pending && !selectorValues.model"
            icon="i-lucide-database"
            title="Select a model"
            description="Choose a dataserve model to inspect its records."
          />

          <UEmpty
            v-else-if="!pending && rows.length === 0"
            icon="i-lucide-table"
            title="No rows"
            description="No records match the selected filters."
          />

          <div
            v-else
            class="space-y-2"
          >
            <p class="text-sm text-muted">
              {{ showingSummary }} (limit {{ limit }})
            </p>

            <div class="overflow-x-auto">
              <UTable
                :data="rows"
                :columns="columns"
                :loading="pending"
                sticky
                class="max-h-[70vh]"
              />
            </div>
          </div>
        </div>
      </div>
    </UPageBody>
  </UPage>
</template>
