import { toRaw } from 'vue'
import type { SelectorOptions } from '~/types/selectors'
import type { DataTableWidgetSpec } from '~/types/data-table-widget'

export type SortDirection = 'asc' | 'desc'
export type SortState = { key: string, direction: SortDirection } | null

const DEFAULT_VOLUMEN_ORDER = [
  'bedrijven',
  'bewoonde oorden 1930',
  'historische woningen in bewoonde oorden 1930',
  'bijstandsontvangers',
  'doelgroepenregister gemeentelijke doelgroep',
  'éénpersoonshuishoudens',
  'extra groei jongeren',
  'extra groei leerlingen voortgezet onderwijs',
  'grote woonkernen',
  'huishoudens met een laag inkomen met drempel',
  'inwoners',
  'inwoners 75+ met drempel',
  'inwoners waddengemeenten (<2500 inwoners)',
  'inwoners waddengemeenten (>7500 inwoners)',
  'inwoners waddengemeenten (2500 tot 7500 inwoners)',
  'jongeren',
  'kernen',
  'laag opleidingsniveau met drempel',
  'leerlingen (voortgezet) speciaal onderwijs',
  'leerlingen voortgezet onderwijs',
  'loonkostensubsidie',
  'migratieachtergrond',
  'landelijke centrumfunctie',
  'lokale centrumfunctie',
  'regionale centrumfunctie',
  '(oeverlengte+2*veen/kleiveengebied)*bf.gemeente*dh.factor',
  'oeverlengte*bodemfactor gemeente',
  'omgevingsadressendichtheid',
  'onderwijsachterstand',
  'oppervlak bebouwing buitengebied',
  'oppervlak bebouwing buitengebied * bodemfactor buitengebied',
  'oppervlak bebouwing woonkern',
  'oppervlak bebouwing woonkern * bodemfactor woonkern',
  'oppervlak binnenwater',
  'oppervlak buitenwater',
  'oppervlak historische kern < 40 ha',
  'oppervlak historische kern > 65 ha',
  'oppervlak historische kern 40 tot 65 ha',
  'oppervlak land * bodemfactor gemeente',
  'oppervlak land',
  'ozb niet-woningen eigenaren',
  'ozb niet-woningen gebruikers',
  'ozb woningen eigenaren',
  'vast bedrag',
  'vast bedrag Amsterdam',
  'verkiezingen Den Haag',
  'vast bedrag Rotterdam',
  'woonruimten',
  'woonruimten * bodemfactor woonkern'
] as const

function normalizeVolumenLabel(input: unknown): string {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .replaceAll('∗', '*')
    .replace(/\s+/g, ' ')
    .trim()
}

const DEFAULT_VOLUMEN_RANK = new Map(
  DEFAULT_VOLUMEN_ORDER.map((label, index) => [normalizeVolumenLabel(label), index])
)

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.round(value))
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed !== '' && Number.isFinite(Number(trimmed))) {
      return String(Math.round(Number(trimmed)))
    }
  }

  return String(value)
}

export function nextSortState(current: SortState, key: string): SortState {
  if (!current || current.key !== key) {
    return { key, direction: 'asc' }
  }
  if (current.direction === 'asc') {
    return { key, direction: 'desc' }
  }
  return null
}

export function formatSortDirection(direction?: SortDirection) {
  if (direction === 'asc') {
    return '↑'
  }
  if (direction === 'desc') {
    return '↓'
  }
  return ''
}

function compareMaybeNumber(a: unknown, b: unknown, direction: SortDirection): number {
  const aNum = typeof a === 'number'
    ? a
    : (typeof a === 'string' && a.trim() !== '' ? Number(a) : Number.NaN)
  const bNum = typeof b === 'number'
    ? b
    : (typeof b === 'string' && b.trim() !== '' ? Number(b) : Number.NaN)

  const aHas = Number.isFinite(aNum)
  const bHas = Number.isFinite(bNum)

  if (aHas && bHas) {
    return direction === 'asc' ? aNum - bNum : bNum - aNum
  }

  const aStr = a === null || a === undefined ? '' : String(a)
  const bStr = b === null || b === undefined ? '' : String(b)
  const cmp = aStr.localeCompare(bStr, 'nl')
  return direction === 'asc' ? cmp : -cmp
}

function stableSort<T>(items: T[], compare: (a: T, b: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const result = compare(a.item, b.item)
      return result !== 0 ? result : a.index - b.index
    })
    .map(({ item }) => item)
}

export function sortTableRows(
  tableId: string | undefined,
  rows: Record<string, unknown>[],
  sort: SortState
): Record<string, unknown>[] {
  if (rows.length === 0) {
    return rows
  }

  if (sort) {
    return stableSort(rows, (a, b) => compareMaybeNumber(a[sort.key], b[sort.key], sort.direction))
  }

  if (tableId === 'au_per_maatstaf' || tableId === 'rekenmodel') {
    return stableSort(rows, (a, b) => {
      const aRank = DEFAULT_VOLUMEN_RANK.get(normalizeVolumenLabel(a.volumen))
      const bRank = DEFAULT_VOLUMEN_RANK.get(normalizeVolumenLabel(b.volumen))

      const aHas = typeof aRank === 'number'
      const bHas = typeof bRank === 'number'

      if (aHas && bHas) {
        return aRank - bRank
      }
      if (aHas) {
        return -1
      }
      if (bHas) {
        return 1
      }

      const aLabel = normalizeVolumenLabel(a.volumen)
      const bLabel = normalizeVolumenLabel(b.volumen)
      return aLabel.localeCompare(bLabel, 'nl')
    })
  }

  return rows
}

const COLUMN_LABELS: Record<string, string> = {
  'volumen': 'Maatstaf',
  'volumen_waarde': 'Volumen',
  'gewicht': 'Gewicht',
  'product': 'Product',
  'product_met_uitkeringsfactor': 'Product met uitkeringsfactor',
  'cluster': 'Cluster',
  'totaal GF': 'Totaal GF'
}

export const TABLE_FILTER_FIELDS = ['gemeente', 'circulaire', 'jaar', 'prijzen_type'] as const

export function tableShowsFilters(tableId: string | undefined) {
  return tableId !== 'au_per_maatstaf' && tableId !== 'rekenmodel' && tableId !== 'cluster_totals'
}

export function columnLabel(key: string) {
  return COLUMN_LABELS[key] ?? key
}

export function tableColumnKeys(
  rows: Record<string, unknown>[],
  selectorFields: Set<string>
): string[] {
  const keys = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!selectorFields.has(key)) {
        keys.add(key)
      }
    }
  }
  return [...keys]
}

export function preferredSelectorValue(field: string, options: SelectorOptions): string | undefined {
  const entries = Object.entries(options)
  if (entries.length === 0) {
    return undefined
  }

  if (field === 'prijzen_type') {
    const match = entries.find(([label, value]) => {
      const haystack = `${label} ${value}`.toLowerCase()
      return haystack.includes('lopende')
    })
    if (match?.[1]) {
      return match[1]
    }
  }

  return entries[0]?.[1]
}

export function buildSelectorItems(options: SelectorOptions, field?: string) {
  const items = Object.entries(options).map(([label, value]) => ({ label, value }))

  if (field === 'gemeente') {
    return items.sort((a, b) => a.label.localeCompare(b.label, 'nl'))
  }

  return items
}

export function isDataTableWidgetSpec(value: unknown): value is DataTableWidgetSpec {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as DataTableWidgetSpec
  return candidate.kind === 'data_table' && Array.isArray(candidate.rows)
}

export function cloneDataTableWidgetSpec(spec: DataTableWidgetSpec): DataTableWidgetSpec {
  return JSON.parse(JSON.stringify(toRaw(spec))) as DataTableWidgetSpec
}
