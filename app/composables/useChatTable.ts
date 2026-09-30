import type { DataTableWidgetSpec } from '~/types/data-table-widget'
import type { TableFilters, TablesResponse } from '~/composables/useTables'
import { cloneDataTableWidgetSpec, preferredSelectorValue } from '~/utils/dataTable'

function sameFilters(a: TableFilters, b: TableFilters) {
  return (
    a.gemeente === b.gemeente
    && a.circulaire === b.circulaire
    && a.jaar === b.jaar
    && a.prijzen_type === b.prijzen_type
  )
}

export function useChatTable(initialSpec: DataTableWidgetSpec) {
  const config = useRuntimeConfig()
  const { apiFetch } = useAuth()
  const spec = ref<DataTableWidgetSpec>(cloneDataTableWidgetSpec(initialSpec))
  const filters = ref<TableFilters>({ ...(initialSpec.filters ?? {}) })
  const pending = ref(false)
  const error = ref<string | null>(null)

  function coerceFilters(next: TableFilters, table: DataTableWidgetSpec): TableFilters {
    const coerced = { ...next }
    let changed = false
    for (const [field, definition] of Object.entries(table.selectors ?? {})) {
      const key = field as keyof TableFilters
      const validValues = Object.values(definition.options)
      if (validValues.length === 0) {
        continue
      }
      const current = coerced[key]
      if (!current || !validValues.includes(current)) {
        coerced[key] = preferredSelectorValue(field, definition.options)
        changed = true
      }
    }
    return changed ? coerced : next
  }

  async function loadTable(nextFilters: TableFilters) {
    pending.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(nextFilters)) {
        if (value) {
          params.set(key, value)
        }
      }
      const query = params.toString()
      const response = await apiFetch(
        query
          ? `${config.public.apiBase}/api/tables/?${query}`
          : `${config.public.apiBase}/api/tables/`
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? `Request failed (${response.status})`)
      }
      const payload = await response.json() as TablesResponse
      const match = payload.tables.find(table => table.id === spec.value.id) ?? payload.tables[0]
      if (!match) {
        throw new Error('No table data available for this selection')
      }
      const nextSpec: DataTableWidgetSpec = {
        kind: 'data_table',
        id: match.id ?? spec.value.id,
        name: match.name ?? spec.value.name,
        rows: match.rows ?? [],
        selectors: match.selectors ?? {},
        filters: nextFilters
      }
      spec.value = nextSpec
      const coerced = coerceFilters(nextFilters, nextSpec)
      if (coerced !== nextFilters) {
        filters.value = coerced
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load table'
    } finally {
      pending.value = false
    }
  }

  watch(
    filters,
    (value) => {
      if (sameFilters(value, spec.value.filters ?? {}) && spec.value.rows.length > 0) {
        return
      }
      void loadTable(value)
    },
    { deep: true }
  )

  return {
    spec,
    filters,
    pending,
    error
  }
}
