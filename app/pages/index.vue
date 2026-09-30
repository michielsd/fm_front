<script setup lang="ts">
const destinations = [
  {
    title: 'Chat',
    description: 'Stel vragen over begrotingen en kengetallen.',
    to: '/chat',
    icon: 'i-lucide-message-square'
  },
  {
    title: 'Tools',
    description: 'Open hulpmiddelen zoals de begrotingsanalyse.',
    to: '/tools',
    icon: 'i-lucide-chart-column'
  },
  {
    title: 'Data viewer',
    description: 'Bekijk records uit de databronnen.',
    to: '/dataviewer',
    icon: 'i-lucide-database'
  }
]

useSeoMeta({
  title: 'FIN monitor',
  description: 'Chat, tools en de data viewer voor gemeentelijke begrotingsgegevens.'
})
</script>

<template>
  <UPage>
    <UPageHeader
      title="Fin Monitor"
      description="Kies waar je verder wilt."
    />

    <UPageBody>
      <UPageGrid>
        <UPageCard
          v-for="item in destinations"
          :key="item.to"
          :title="item.title"
          :description="item.description"
          :icon="item.icon"
          :to="item.to"
        />
      </UPageGrid>
    </UPageBody>
  </UPage>
</template>
