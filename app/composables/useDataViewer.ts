import type { SelectorDefinition } from '~/types/selectors'

export interface DataViewerModelMeta {
  has_circulaire: boolean
  has_jaar: boolean
}

export interface DataViewerResponse {
  selectors: Record<string, SelectorDefinition>
  rows: Record<string, unknown>[]
  total_count: number
  limit: number
  model_meta: DataViewerModelMeta
}

export type DataViewerLimit = '10' | '25' | '50' | '100' | '250' | '500'

export interface DataViewerFilters {
  model?: string
  circulaire?: string
  jaar?: string
  limit?: DataViewerLimit
}

function buildDataViewerUrl(base: string, filters: DataViewerFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `${base}/api/dataviewer/?${query}` : `${base}/api/dataviewer/`
}

export function useDataViewer(filters: Ref<DataViewerFilters> | ComputedRef<DataViewerFilters>) {
  const config = useRuntimeConfig()
  const { authedFetch } = useAuth()
  const url = computed(() => buildDataViewerUrl(config.public.apiBase, unref(filters)))

  const { data, pending, error, refresh } = useFetch<DataViewerResponse>(url, {
    key: () => `dataviewer:${url.value}`,
    watch: [url],
    $fetch: authedFetch
  })

  const selectors = computed(() => data.value?.selectors ?? {})
  const rows = computed(() => data.value?.rows ?? [])
  const totalCount = computed(() => data.value?.total_count ?? 0)
  const limit = computed(() => data.value?.limit ?? 10)
  const modelMeta = computed(() => data.value?.model_meta ?? { has_circulaire: false, has_jaar: false })

  return {
    selectors,
    rows,
    totalCount,
    limit,
    modelMeta,
    pending,
    error,
    refresh
  }
}
