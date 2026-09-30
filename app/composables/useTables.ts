import type { SelectorDefinition } from '~/types/selectors'

export interface TablePayload {
  id?: string
  name?: string
  rows: Record<string, unknown>[]
  /**
   * Selector field name → definition.
   * The key is the row field / query parameter name (e.g. `kengetal`, `type_raming`).
   */
  selectors?: Record<string, SelectorDefinition>
}

export interface TablesResponse {
  tables: TablePayload[]
}

export interface TableFilters {
  gemeente?: string
  circulaire?: string
  jaar?: string
  prijzen_type?: string
}

function buildTablesUrl(base: string, filters: TableFilters): string {
  const params = new URLSearchParams()
  if (filters.gemeente) {
    params.set('gemeente', filters.gemeente)
  }
  if (filters.circulaire) {
    params.set('circulaire', filters.circulaire)
  }
  if (filters.jaar) {
    params.set('jaar', filters.jaar)
  }
  if (filters.prijzen_type) {
    params.set('prijzen_type', filters.prijzen_type)
  }
  const query = params.toString()
  return query ? `${base}/api/tables/?${query}` : `${base}/api/tables/`
}

export function useTables(filters: Ref<TableFilters> | ComputedRef<TableFilters>) {
  const config = useRuntimeConfig()
  const { authedFetch } = useAuth()

  const url = computed(() => buildTablesUrl(config.public.apiBase, unref(filters)))

  const { data, pending, error, refresh } = useFetch<TablesResponse>(url, {
    key: () => `tables:${url.value}`,
    watch: [url],
    $fetch: authedFetch
  })

  const tables = computed(() => data.value?.tables ?? [])

  return {
    tables,
    pending,
    error,
    refresh
  }
}
