<script setup lang="ts">
const { user, logout } = useAuth()

async function onLogout() {
  logout()
  await navigateTo('/login')
}
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
      >
        <img
          src="/fin_monitor.png"
          alt=""
          class="h-8 w-auto shrink-0"
        />
        <span class="text-sm font-semibold tracking-tight">
          FIN monitor
        </span>
      </NuxtLink>

      <UButton
        to="/chat"
        label="Chat"
        color="neutral"
        variant="ghost"
        size="xs"
      />

      <UButton
        to="/dataviewer"
        label="Data viewer"
        color="neutral"
        variant="ghost"
        size="xs"
      />

      <UButton
        to="/tools"
        label="Tools"
        color="neutral"
        variant="ghost"
        size="xs"
      />
    </template>

    <template #right>
      <span
        v-if="user"
        class="text-sm text-muted"
      >
        {{ user.username }}
      </span>

      <UButton
        v-if="user"
        label="Log out"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="onLogout"
      />
      <UButton
        v-else
        to="/login"
        label="Sign in"
        color="neutral"
        variant="ghost"
        size="xs"
      />

      <UColorModeButton />
    </template>
  </UHeader>
</template>
