<script setup lang="ts">
const tools = [
  {
    name: 'Begrotingsanalyse',
    description: 'Vergelijk netto lasten met het gemeentefonds per cluster. Zonder chat opent de tool met de meest recente cijfers.',
    to: '/tools/begrotingsanalyse',
    icon: 'i-lucide-chart-column'
  },
  {
    name: 'AU per maatstaf',
    description: 'Bekijk de algemene uitkering per maatstaf.',
    to: '/tools/au-per-maatstaf',
    icon: 'i-lucide-table'
  },
  {
    name: 'Clustertotalen',
    description: 'Bekijk de gemeentefondstotalen per cluster.',
    to: '/tools/clustertotalen',
    icon: 'i-lucide-table-2'
  }
]

useSeoMeta({
  title: 'Tools',
  description: 'Hulpmiddelen voor gemeentelijke begrotingsgegevens.'
})
</script>

<template>
  <UPage>
    <UPageHeader
      title="Tools"
      description="Kies een hulpmiddel."
    />

    <UPageBody>
      <div class="flex w-full flex-col gap-3">
        <NuxtLink
          v-for="tool in tools"
          :key="tool.to"
          :to="tool.to"
          class="flex items-start gap-4 rounded-xl border border-default bg-elevated/40 px-4 py-4 transition-colors hover:bg-elevated"
        >
          <UIcon
            :name="tool.icon"
            class="mt-0.5 size-5 shrink-0 text-primary"
          />
          <span>
            <span class="block font-medium text-highlighted">
              {{ tool.name }}
            </span>
            <span class="mt-1 block text-sm text-muted">
              {{ tool.description }}
            </span>
          </span>
        </NuxtLink>
      </div>
    </UPageBody>
  </UPage>
</template>
