export interface BegrotingsanalyseSeries {
  name: string
  values: number[]
}

export interface BegrotingsanalyseParams {
  gemeente: string
  gemeente_naam?: string
  jaar: string
  verslagsoort: string
  circulaire: string
  overhead: boolean
}

export interface BegrotingsanalyseChartSpec {
  kind: 'begrotingsanalyse_chart'
  id: string
  name: string
  unit: string
  categories: string[]
  series: BegrotingsanalyseSeries[]
  legend?: string
  filters?: Record<string, string>
  params?: BegrotingsanalyseParams
}
