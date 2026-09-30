import type { KengetallenWidgetSpec } from '~/types/kengetallen-widget'
import { cloneKengetallenWidgetSpec } from '~/utils/kengetallenChart'

export function useKengetallenChart(initialSpec: KengetallenWidgetSpec) {
  const config = useRuntimeConfig()
  const { apiFetch } = useAuth()
  const spec = ref<KengetallenWidgetSpec>(cloneKengetallenWidgetSpec(initialSpec))
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function loadChart(kengetal: string) {
    pending.value = true
    error.value = null
    try {
      const params = new URLSearchParams({
        gemeente: spec.value.gemeente,
        kengetal
      })
      const response = await apiFetch(
        `${config.public.apiBase}/api/kengetallen-chart/?${params.toString()}`
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? `Request failed (${response.status})`)
      }
      spec.value = await response.json() as KengetallenWidgetSpec
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load chart'
    } finally {
      pending.value = false
    }
  }

  return {
    spec,
    pending,
    error,
    loadChart
  }
}
