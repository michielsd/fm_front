<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { DataTableWidgetSpec } from '~/types/data-table-widget'
import type { TableFilters } from '~/composables/useTables'
import {
  buildSelectorItems,
  columnLabel,
  formatCellValue,
  formatSortDirection,
  nextSortState,
  sortTableRows,
  TABLE_FILTER_FIELDS,
  tableColumnKeys,
  tableShowsFilters,
  type SortState
} from '~/utils/dataTable'

const props = defineProps<{
  initialSpec: DataTableWidgetSpec
}>()

const { spec, filters, pending, error } = useChatTable(props.initialSpec)
const sortState = ref<SortState>(null)

const selectorEntries = computed(() => {
  if (!tableShowsFilters(spec.value.id)) {
    return []
  }
  return Object.entries(spec.value.selectors ?? {}).map(([field, definition]) => ({
    field,
    label: definition.label ?? field,
    options: definition.options
  }))
})

const selectorFieldNames = computed(() => {
  const fields = new Set(Object.keys(spec.value.selectors ?? {}))
  if (!tableShowsFilters(spec.value.id)) {
    for (const field of TABLE_FILTER_FIELDS) {
      fields.add(field)
    }
  }
  return fields
})

const filtersComplete = computed(() =>
  Boolean(
    filters.value.gemeente
    && filters.value.circulaire
    && filters.value.jaar
    && filters.value.prijzen_type
  )
)

const displayedRows = computed(() =>
  sortTableRows(spec.value.id, spec.value.rows ?? [], sortState.value)
)

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
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-default bg-elevated/40">
    <div class="border-b border-default px-4 py-3">
      <p class="font-medium text-highlighted">
        {{ spec.name }}
      </p>
    </div>

    <div class="space-y-4 px-4 py-4">
      <div
        v-if="selectorEntries.length > 0"
        class="flex flex-wrap gap-3"
      >
        <UFormField
          v-for="selector in selectorEntries"
          :key="selector.field"
          :label="selector.label"
          :class="selector.field === 'gemeente' || selector.field === 'prijzen_type'
            ? 'min-w-64 flex-1'
            : 'min-w-40 flex-1'"
        >
          <USelect
            v-model="filters[selector.field as keyof TableFilters]"
            :items="buildSelectorItems(selector.options, selector.field)"
            value-key="value"
            label-key="label"
            :loading="pending"
            class="w-full"
          />
        </UFormField>
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
      />

      <p
        v-else-if="!pending && !filtersComplete"
        class="py-8 text-center text-sm text-muted"
      >
        Kies een gemeente, circulaire, jaar en prijzen type om de tabel te laden.
      </p>

      <p
        v-else-if="!pending && displayedRows.length === 0"
        class="py-8 text-center text-sm text-muted"
      >
        Geen rijen voor deze selectie.
      </p>

      <div
        v-else
        class="overflow-x-auto"
      >
        <UTable
          :data="displayedRows"
          :columns="columns"
          :loading="pending"
          sticky
          class="max-h-80"
        />
      </div>
    </div>
  </div>
</template>
