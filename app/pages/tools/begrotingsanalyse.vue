<script setup lang="ts">
import type { BegrotingsanalyseParams } from '~/types/begrotingsanalyse-widget'
import { isBegrotingsanalyseChartSpec } from '~/utils/begrotingsanalyseChart'
import { isDataTableWidgetSpec } from '~/utils/dataTable'

interface CirculaireOption {
  value: string
  label: string
}

interface YearOption {
  jaar: string
  circulaires: CirculaireOption[]
}

interface DocumentOption {
  verslagsoort: string
  years: YearOption[]
}

interface GemeenteCatalogEntry {
  code: string
  naam: string
}

interface CatalogPayload {
  gemeenten: GemeenteCatalogEntry[]
  documents?: DocumentOption[]
  defaults: BegrotingsanalyseParams
  error?: string
}

interface OptionsPayload {
  gemeente: string
  gemeente_naam: string
  documents: DocumentOption[]
  error?: string
}

interface AnalysisPayload {
  widgets?: unknown[]
  params?: BegrotingsanalyseParams
  error?: string
}

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const { apiFetch } = useAuth()

const gemeente = ref('')
const conversationId = ref('')
const catalog = ref<GemeenteCatalogEntry[]>([])
const options = ref<OptionsPayload | null>(null)
const widgets = ref<unknown[]>([])
const resolvedParams = ref<BegrotingsanalyseParams | null>(null)
const verslagsoort = ref('')
const jaar = ref('')
const circulaire = ref('')
const overhead = ref(false)
const pending = ref(true)
const error = ref<string | null>(null)

let requestSerial = 0
let queryQueue: Promise<void> = Promise.resolve()

function queryString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

const documents = computed(() => options.value?.documents ?? [])

const yearOptions = computed(() =>
  documents.value.find(document => document.verslagsoort === verslagsoort.value)?.years ?? []
)

const circulaireOptions = computed(() =>
  yearOptions.value.find(year => year.jaar === jaar.value)?.circulaires ?? []
)

const gemeenteItems = computed(() =>
  catalog.value.map(entry => ({
    label: `${entry.naam} (${entry.code})`,
    value: entry.code
  }))
)

const verslagItems = computed(() =>
  documents.value.map(document => ({
    label: document.verslagsoort,
    value: document.verslagsoort
  }))
)

const jaarItems = computed(() =>
  yearOptions.value.map(year => ({ label: year.jaar, value: year.jaar }))
)

const circulaireItems = computed(() =>
  circulaireOptions.value.map(item => ({ label: item.label, value: item.value }))
)

const overheadItems = [
  { label: 'Niet toedelen', value: '0' },
  { label: 'Toedelen', value: '1' }
]

const chart = computed(() => widgets.value.find(isBegrotingsanalyseChartSpec) ?? null)

const tables = computed(() => widgets.value.filter(isDataTableWidgetSpec))

const widgetKey = computed(() => {
  const params = resolvedParams.value
  if (!params) {
    return 'empty'
  }
  return `${params.gemeente}-${params.verslagsoort}-${params.jaar}-${params.circulaire}-${params.overhead ? '1' : '0'}`
})

const pageDescription = computed(() => {
  if (options.value?.gemeente_naam) {
    return `${options.value.gemeente_naam}: netto lasten tegen het gemeentefonds.`
  }
  return 'Vergelijk netto lasten met het gemeentefonds per cluster.'
})

function latestYearNumber(document: DocumentOption) {
  return Number(document.years.at(-1)?.jaar ?? -1)
}

function preferredDocument(available: DocumentOption[], requested: string) {
  const match = available.find(document => document.verslagsoort === requested)
  if (match) {
    return match
  }
  return available.reduce<DocumentOption | undefined>((best, document) => {
    if (!best) {
      return document
    }
    const year = latestYearNumber(document)
    const bestYear = latestYearNumber(best)
    if (year > bestYear || (year === bestYear && document.verslagsoort === 'Begroting')) {
      return document
    }
    return best
  }, undefined)
}

function coerce(next: { verslagsoort: string, jaar: string, circulaire: string }) {
  const availableDocuments = documents.value
  const selectedDocument = preferredDocument(availableDocuments, next.verslagsoort)
  const selectedVerslag = selectedDocument?.verslagsoort ?? ''
  const years = availableDocuments.find(document => document.verslagsoort === selectedVerslag)?.years ?? []
  const selectedJaar = years.some(year => year.jaar === next.jaar)
    ? next.jaar
    : (years.at(-1)?.jaar ?? '')
  const circulaires = years.find(year => year.jaar === selectedJaar)?.circulaires ?? []
  const selectedCirculaire = circulaires.some(item => item.value === next.circulaire)
    ? next.circulaire
    : (circulaires.at(-1)?.value ?? '')
  return {
    verslagsoort: selectedVerslag,
    jaar: selectedJaar,
    circulaire: selectedCirculaire
  }
}

function scheduleQuerySync(serial: number, params: BegrotingsanalyseParams) {
  queryQueue = queryQueue.then(async () => {
    if (serial !== requestSerial) {
      return
    }
    const query: Record<string, string> = {
      gemeente: params.gemeente,
      jaar: params.jaar,
      verslagsoort: params.verslagsoort,
      circulaire: params.circulaire,
      overhead: params.overhead ? '1' : '0'
    }
    if (conversationId.value) {
      query.conversation = conversationId.value
    }
    await router.replace({ path: '/tools/begrotingsanalyse', query })
  }).catch(() => undefined)
}

async function loadWidgets() {
  const current = ++requestSerial
  pending.value = true
  error.value = null
  try {
    const params = new URLSearchParams({
      gemeente: gemeente.value,
      jaar: jaar.value,
      verslagsoort: verslagsoort.value,
      circulaire: circulaire.value,
      overhead: overhead.value ? '1' : '0'
    })
    const response = await apiFetch(`${config.public.apiBase}/api/begrotingsanalyse/?${params.toString()}`)
    const payload = await response.json().catch(() => null) as AnalysisPayload | null
    if (current !== requestSerial) {
      return
    }
    if (!response.ok || !payload || payload.error || !payload.params) {
      throw new Error(payload?.error ?? `Request failed (${response.status})`)
    }
    widgets.value = payload.widgets ?? []
    resolvedParams.value = payload.params
    scheduleQuerySync(current, payload.params)
  } catch (err) {
    if (current !== requestSerial) {
      return
    }
    error.value = err instanceof Error ? err.message : 'Begrotingsanalyse laden mislukt'
    widgets.value = []
    resolvedParams.value = null
  } finally {
    if (current === requestSerial) {
      pending.value = false
    }
  }
}

async function applySelection(next: {
  verslagsoort: string
  jaar: string
  circulaire: string
  overhead: boolean
}) {
  const coerced = coerce(next)
  verslagsoort.value = coerced.verslagsoort
  jaar.value = coerced.jaar
  circulaire.value = coerced.circulaire
  overhead.value = next.overhead
  await loadWidgets()
}

function setOptions(code: string, naam: string, documents: DocumentOption[]) {
  gemeente.value = code
  options.value = {
    gemeente: code,
    gemeente_naam: naam,
    documents
  }
}

async function fetchOptions(code: string) {
  const response = await apiFetch(
    `${config.public.apiBase}/api/begrotingsanalyse/options/?gemeente=${encodeURIComponent(code)}`
  )
  const payload = await response.json().catch(() => null) as OptionsPayload | null
  if (!response.ok || !payload || payload.error) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`)
  }
  return payload
}

async function onGemeenteChange(value: string | undefined) {
  if (!value || value === gemeente.value) {
    return
  }
  const entry = catalog.value.find(item => item.code === value)
  if (!entry) {
    return
  }
  pending.value = true
  error.value = null
  try {
    const payload = await fetchOptions(value)
    setOptions(payload.gemeente, payload.gemeente_naam, payload.documents)
    await applySelection({
      verslagsoort: '',
      jaar: '',
      circulaire: '',
      overhead: overhead.value
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Opties laden mislukt'
    pending.value = false
  }
}

async function loadPage() {
  pending.value = true
  error.value = null
  try {
    const response = await apiFetch(`${config.public.apiBase}/api/begrotingsanalyse/catalog/`)
    const payload = await response.json().catch(() => null) as CatalogPayload | null
    if (!response.ok || !payload || payload.error || !payload.defaults) {
      throw new Error(payload?.error ?? `Request failed (${response.status})`)
    }
    catalog.value = payload.gemeenten ?? []
    const requested = queryString(route.query.gemeente)
    const entry = catalog.value.find(item => item.code === requested || item.naam === requested)
    if (requested && !entry) {
      throw new Error(`Onbekende gemeente: ${requested}`)
    }
    const selectedCode = entry?.code ?? payload.defaults.gemeente
    if (selectedCode === payload.defaults.gemeente) {
      setOptions(payload.defaults.gemeente, payload.defaults.gemeente_naam ?? '', payload.documents ?? [])
    } else if (entry) {
      const optionsPayload = await fetchOptions(entry.code)
      setOptions(optionsPayload.gemeente, optionsPayload.gemeente_naam, optionsPayload.documents)
    }
    const fromQuery = Boolean(requested)
    await applySelection({
      verslagsoort: fromQuery ? queryString(route.query.verslagsoort) : payload.defaults.verslagsoort,
      jaar: fromQuery ? queryString(route.query.jaar) : payload.defaults.jaar,
      circulaire: fromQuery ? queryString(route.query.circulaire) : payload.defaults.circulaire,
      overhead: fromQuery
        ? route.query.overhead === '1' || route.query.overhead === 'true'
        : false
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Opties laden mislukt'
    pending.value = false
  }
}

function onVerslagsoortChange(value: string | undefined) {
  if (!value || value === verslagsoort.value) {
    return
  }
  void applySelection({
    verslagsoort: value,
    jaar: '',
    circulaire: '',
    overhead: overhead.value
  })
}

function onJaarChange(value: string | undefined) {
  if (!value || value === jaar.value) {
    return
  }
  void applySelection({
    verslagsoort: verslagsoort.value,
    jaar: value,
    circulaire: '',
    overhead: overhead.value
  })
}

function onCirculaireChange(value: string | undefined) {
  if (!value || value === circulaire.value) {
    return
  }
  void applySelection({
    verslagsoort: verslagsoort.value,
    jaar: jaar.value,
    circulaire: value,
    overhead: overhead.value
  })
}

function onOverheadChange(value: string | undefined) {
  const next = value === '1'
  if (value === undefined || next === overhead.value) {
    return
  }
  void applySelection({
    verslagsoort: verslagsoort.value,
    jaar: jaar.value,
    circulaire: circulaire.value,
    overhead: next
  })
}

function analyseInChat() {
  const params = resolvedParams.value
  if (!conversationId.value || !params || pending.value) {
    return
  }
  void router.push({
    path: `/chat/${conversationId.value}`,
    query: {
      tool: 'begrotingsanalyse',
      gemeente: params.gemeente,
      jaar: params.jaar,
      verslagsoort: params.verslagsoort,
      circulaire: params.circulaire,
      overhead: params.overhead ? '1' : '0'
    }
  })
}

onMounted(() => {
  conversationId.value = queryString(route.query.conversation)
  void loadPage()
})

useSeoMeta({
  title: 'Begrotingsanalyse',
  description: 'Vergelijk netto lasten met het gemeentefonds per cluster.'
})
</script>

<template>
  <UPage>
    <UPageHeader
      title="Begrotingsanalyse"
      :description="pageDescription"
    >
      <template #links>
        <UButton
          v-if="conversationId"
          :to="`/chat/${conversationId}`"
          label="Terug naar chat"
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-left"
        />
        <UButton
          label="Analyseer in chat"
          icon="i-lucide-message-square"
          :disabled="!conversationId || !resolvedParams || pending"
          @click="analyseInChat"
        />
      </template>
    </UPageHeader>

    <UPageBody>
      <div class="flex w-full flex-col gap-4">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Begrotingsanalyse laden mislukt"
          :description="error"
        />

        <div
          v-if="pending && gemeenteItems.length === 0"
          class="flex flex-col gap-4"
        >
          <div class="flex flex-wrap gap-3">
            <USkeleton class="h-14 min-w-48 flex-1 rounded-md" />
            <USkeleton class="h-14 min-w-36 flex-1 rounded-md" />
            <USkeleton class="h-14 min-w-36 flex-1 rounded-md" />
            <USkeleton class="h-14 min-w-44 flex-1 rounded-md" />
          </div>
          <USkeleton class="h-80 w-full rounded-xl" />
        </div>

        <div
          v-if="gemeenteItems.length > 0"
          class="flex flex-wrap items-end gap-3"
        >
          <UFormField
            label="Gemeente"
            class="min-w-72 flex-1"
          >
            <USelect
              :model-value="gemeente"
              :items="gemeenteItems"
              :loading="pending"
              class="w-full"
              @update:model-value="onGemeenteChange"
            />
          </UFormField>

          <UFormField
            label="Verslagsoort"
            class="min-w-48 flex-1"
          >
            <USelect
              :model-value="verslagsoort"
              :items="verslagItems"
              :loading="pending"
              class="w-full"
              @update:model-value="onVerslagsoortChange"
            />
          </UFormField>

          <UFormField
            label="Jaar"
            class="min-w-36 flex-1"
          >
            <USelect
              :model-value="jaar"
              :items="jaarItems"
              :loading="pending"
              class="w-full"
              @update:model-value="onJaarChange"
            />
          </UFormField>

          <UFormField
            label="Gemeentefonds"
            class="min-w-56 flex-1"
          >
            <USelect
              :model-value="circulaire"
              :items="circulaireItems"
              :loading="pending"
              class="w-full"
              @update:model-value="onCirculaireChange"
            />
          </UFormField>

          <UFormField
            label="Overhead"
            class="min-w-44 flex-1"
          >
            <USelect
              :model-value="overhead ? '1' : '0'"
              :items="overheadItems"
              :loading="pending"
              class="w-full"
              @update:model-value="onOverheadChange"
            />
          </UFormField>
        </div>

        <p
          v-if="gemeenteItems.length > 0 && !conversationId"
          class="text-sm text-muted"
        >
          Open de tool vanuit een gesprek om de analyse daar te laten samenvatten.
        </p>

        <USkeleton
          v-if="pending && !chart && gemeenteItems.length > 0"
          class="h-80 w-full rounded-xl"
        />

        <div
          v-if="chart || tables.length > 0"
          :key="widgetKey"
          class="flex flex-col gap-4"
        >
          <Suspense v-if="chart">
            <LazyChatBegrotingsanalyseWidget :spec="chart" />
            <template #fallback>
              <ChatTableWidgetSkeleton :name="chart.name" />
            </template>
          </Suspense>

          <Suspense
            v-for="table in tables"
            :key="table.id"
          >
            <LazyChatTableWidget :initial-spec="table" />
            <template #fallback>
              <ChatTableWidgetSkeleton :name="table.name" />
            </template>
          </Suspense>
        </div>
      </div>
    </UPageBody>
  </UPage>
</template>
