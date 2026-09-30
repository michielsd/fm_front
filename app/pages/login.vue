<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const { login } = useAuth()

const username = ref('')
const password = ref('')
const pending = ref(false)
const error = ref<string | null>(null)
const checkingApi = ref(true)
const apiAvailable = ref(false)

async function checkApi() {
  checkingApi.value = true
  try {
    const response = await fetch(`${config.public.apiBase}/healthz/`)
    const payload = await response.json().catch(() => null) as { status?: string } | null
    apiAvailable.value = response.ok && payload?.status === 'ok'
  } catch {
    apiAvailable.value = false
  } finally {
    checkingApi.value = false
  }
}

const apiStatusLabel = computed(() => {
  if (checkingApi.value) {
    return 'API controleren…'
  }
  return apiAvailable.value ? 'API beschikbaar' : 'API niet beschikbaar'
})

const apiStatusClass = computed(() => {
  if (checkingApi.value) {
    return 'text-muted'
  }
  return apiAvailable.value ? 'text-success' : 'text-error'
})

onMounted(() => {
  checkApi()
})

async function onSubmit() {
  error.value = null
  pending.value = true
  try {
    await login(username.value.trim(), password.value)
    await navigateTo(safeRedirect(route.query.redirect))
  } catch {
    error.value = 'Invalid username or password'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
    <UCard class="w-full">
      <template #header>
        <h1 class="text-xl font-semibold">
          Sign in
        </h1>
        <p class="mt-1 text-sm text-muted">
          Use the account created for you to open FIN monitor.
        </p>
        <p
          class="mt-3 text-sm font-medium"
          :class="apiStatusClass"
        >
          {{ apiStatusLabel }}
        </p>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="onSubmit"
      >
        <UFormField
          label="Username"
          name="username"
        >
          <UInput
            v-model="username"
            autocomplete="username"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField
          label="Password"
          name="password"
        >
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="w-full"
            required
          />
        </UFormField>

        <p
          v-if="error"
          class="text-sm text-error"
        >
          {{ error }}
        </p>

        <UButton
          type="submit"
          block
          :loading="pending"
        >
          Sign in
        </UButton>
      </form>
    </UCard>
  </div>
</template>
