<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { TableFilters } from '~/composables/useTables'
import {
  buildSelectorItems,
  columnLabel,
  formatCellValue,
  formatSortDirection,
  nextSortState,
  preferredSelectorValue,
  sortTableRows,
  tableColumnKeys,
  type SortState
} from '~/utils/dataTable'

const props = defineProps<{
  tableId: string
  title: string
  description: string
  emptyDescription: string
}>()

const selectorValues = ref<TableFilters>({})
const selectorsInitialized = ref(false)

const filters = computed<TableFilters>(() => ({
  gemeente: selectorValues.value.gemeente,
  circulaire: selectorValues.value.circulaire,
  jaar: selectorValues.value.jaar,
  prijzen_type: selectorValues.value.prijzen_type
}))

const filtersComplete = computed(() =>
  Boolean(
    filters.value.gemeente
    && filters.value.circulaire
    && filters.value.jaar
    && filters.value.prijzen_type
  )
)

const { tables, pending, error, refresh } = useTables(filters)

const selectedTable = computed(() =>
  tables.value.find(table => table.id === props.tableId) ?? null
)

const selectorEntries = computed(() => {
  const selectors = selectedTable.value?.selectors
  if (!selectors) {
    return []
  }

  return Object.entries(selectors).map(([field, definition]) => ({
    field,
    label: definition.label ?? field,
    options: definition.options
  }))
})

watch(
  tables,
  (list) => {
    const table = list.find(item => item.id === props.tableId) ?? list[0]
    if (!table?.selectors) {
      return
    }

    if (!selectorsInitialized.value) {
      const defaults: TableFilters = {}
      for (const [field, definition] of Object.entries(table.selectors)) {
        const key = field as keyof TableFilters
        const preferred = preferredSelectorValue(field, definition.options)
        if (preferred) {
          defaults[key] = preferred
        }
      }
      selectorValues.value = defaults
      selectorsInitialized.value = true
      return
    }

    const next = { ...selectorValues.value }
    let changed = false
    for (const [field, definition] of Object.entries(table.selectors)) {
      const key = field as keyof TableFilters
      const current = next[key]
      const validValues = Object.values(definition.options)
      if (validValues.length === 0) {
        continue
      }

      if (!current || !validValues.includes(current)) {
        next[key] = preferredSelectorValue(field, definition.options)
        changed = true
      }
    }
    if (changed) {
      selectorValues.value = next
    }
  },
  { immediate: true }
)

const selectorFieldNames = computed(
  () => new Set(Object.keys(selectedTable.value?.selectors ?? {}))
)

const sortState = ref<SortState>(null)

const displayedRows = computed(() => {
  const table = selectedTable.value
  const rows = (table?.rows ?? []) as Record<string, unknown>[]
  if (!table || rows.length === 0) {
    return rows
  }
  return sortTableRows(table.id, rows, sortState.value)
})

const columns = computed<TableColumn<Record<string, unknown>>[]>(() =>
  tableColumnKeys(displayedRows.value, selectorFieldNames.value).map(key => ({
    accessorKey: key,
    header: () => {
      const isActive = sortState.value?.key === key
      const direction = isActive ? sortState.value?.direction : undefined
      return h(
        'button',
        {
          type: 'button',
          class: 'inline-flex items-center gap-1 font-medium hover:underline',
          onClick: () => { sortState.value = nextSortState(sortState.value, key) }
        },
        [columnLabel(key), direction ? ` ${formatSortDirection(direction)}` : '']
      )
    },
    cell: ({ row }) => formatCellValue(row.getValue(key))
  }))
)

useSeoMeta({
  title: () => props.title,
  description: () => props.description
})
</script>

<template>
  <UPage>
    <UPageHeader
      :title="title"
      :description="description"
    >
      <template #links>
        <UButton
          icon="i-lucide-refresh-cw"
          label="Vernieuwen"
          color="neutral"
          variant="outline"
          :loading="pending"
          @click="refresh()"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <div class="w-full space-y-4">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Tabel laden mislukt"
          :description="error.message"
        />

        <div
          v-if="pending && !selectedTable"
          class="flex items-center justify-center py-16 text-muted"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-6 animate-spin"
          />
        </div>

        <template v-else-if="selectedTable">
          <div
            v-if="selectorEntries.length > 0"
            class="flex flex-wrap gap-4"
          >
            <UFormField
              v-for="selector in selectorEntries"
              :key="selector.field"
              :label="selector.label"
              :class="selector.field === 'gemeente' || selector.field === 'prijzen_type'
                ? 'min-w-72 max-w-lg flex-1'
                : 'min-w-48 max-w-xs flex-1'"
            >
              <USelect
                v-model="selectorValues[selector.field as keyof TableFilters]"
                :items="buildSelectorItems(selector.options, selector.field)"
                value-key="value"
                label-key="label"
                :class="selector.field === 'gemeente' || selector.field === 'prijzen_type' ? 'w-full min-w-72' : undefined"
                :ui="selector.field === 'gemeente' || selector.field === 'prijzen_type' ? { content: 'min-w-fit' } : undefined"
              />
            </UFormField>
          </div>

          <UEmpty
            v-if="!pending && !filtersComplete"
            icon="i-lucide-filter"
            title="Kies filters"
            description="Kies een gemeente, circulaire, jaar en prijzentype om de tabel te laden."
          />

          <UEmpty
            v-else-if="!pending && filtersComplete && (selectedTable.rows?.length ?? 0) === 0"
            icon="i-lucide-table"
            title="Geen rijen"
            :description="emptyDescription"
          />

          <div
            v-else
            class="overflow-x-auto"
          >
            <UTable
              :data="displayedRows"
              :columns="columns"
              :loading="pending"
              sticky
              class="max-h-[70vh]"
            />
          </div>
        </template>

        <UEmpty
          v-else-if="!pending"
          icon="i-lucide-table"
          title="Geen tabel"
          description="De API heeft deze tabel niet teruggegeven."
        />
      </div>
    </UPageBody>
  </UPage>
</template>
