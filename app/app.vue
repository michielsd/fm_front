<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'FIN monitor'
const description = 'Chat, tools en de data viewer voor gemeentelijke begrotingsgegevens.'

useHead({
  title,
  titleTemplate: (pageTitle) => {
    return pageTitle && pageTitle !== title ? `${pageTitle} · ${title}` : title
  }
})

useSeoMeta({
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
