<template>
  <div>
    <AppHeader />

    <UMain>
      <UContainer>
        <slot />
      </UContainer>
    </UMain>

    <USeparator />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          FIN monitor • © {{ new Date().getFullYear() }}
        </p>
      </template>
    </UFooter>
  </div>
</template>
