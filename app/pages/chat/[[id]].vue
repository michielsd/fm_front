<script setup lang="ts">
import { isTextUIPart } from 'ai'
import type { BegrotingsanalyseParams } from '~/types/begrotingsanalyse-widget'

definePageMeta({
  layout: 'chat'
})

const route = useRoute()
const router = useRouter()
const input = ref('')
const loadingConversation = ref(false)

const {
  messages,
  conversationId,
  uiMessages,
  status,
  chatError,
  isStreaming,
  widgetsForMessage,
  hydrateConversation,
  sendMessage,
  analyseBegrotingsanalyse,
  stopStreaming,
  clearMessages
} = useChatStream()

const { fetchConversation } = useConversations()

const hasMessages = computed(() => uiMessages.value.length > 0)
const handoffStarted = ref(false)

function queryValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

const greeting = computed(() => {
  const hour = new Date().getHours()
  let timeGreeting = 'Goedenavond'
  if (hour < 12) {
    timeGreeting = 'Goedemorgen'
  } else if (hour < 18) {
    timeGreeting = 'Goedemiddag'
  }
  return timeGreeting
})

const quickChats = [
  {
    label: 'Wat is de structurele exploitatieruimte van Amsterdam in 2025?',
    icon: 'i-lucide-building-2'
  },
  {
    label: 'Welke kengetallen zijn beschikbaar voor Utrecht?',
    icon: 'i-lucide-list'
  },
  {
    label: 'Vergelijk begrotingscijfers van Rotterdam en Den Haag',
    icon: 'i-lucide-git-compare'
  },
  {
    label: 'Leg het verschil uit tussen begroting en jaar',
    icon: 'i-lucide-help-circle'
  },
  {
    label: 'Toon de clustertotalen voor Eindhoven',
    icon: 'i-lucide-calculator'
  },
  {
    label: 'Welke databronnen kun je raadplegen?',
    icon: 'i-lucide-database'
  }
]

const pageTitle = computed(() => {
  if (!hasMessages.value) {
    return 'Chat'
  }
  return 'Kengetallen chat'
})

watch(
  () => route.params.id,
  async (id) => {
    if (!import.meta.client) {
      return
    }
    const nextId = typeof id === 'string' ? id : ''
    if (!nextId) {
      if (!isStreaming.value) {
        clearMessages()
      }
      return
    }
    if (nextId === conversationId.value && (isStreaming.value || messages.value.length > 0)) {
      return
    }
    if (isStreaming.value) {
      stopStreaming()
    }
    loadingConversation.value = true
    try {
      const detail = await fetchConversation(nextId)
      hydrateConversation(detail)
    } catch {
      clearMessages()
      await router.replace('/chat')
    } finally {
      loadingConversation.value = false
    }
  },
  { immediate: true }
)

watch(
  () => ({
    tool: queryValue(route.query.tool),
    loading: loadingConversation.value,
    id: conversationId.value,
    routeId: typeof route.params.id === 'string' ? route.params.id : ''
  }),
  async (state) => {
    if (!import.meta.client || handoffStarted.value || state.loading) {
      return
    }
    if (state.tool !== 'begrotingsanalyse' || !state.routeId || state.id !== state.routeId) {
      return
    }
    const gemeente = queryValue(route.query.gemeente)
    const jaar = queryValue(route.query.jaar)
    const verslagsoort = queryValue(route.query.verslagsoort)
    const circulaire = queryValue(route.query.circulaire)
    if (!gemeente || !jaar || !verslagsoort || !circulaire) {
      return
    }
    const params: BegrotingsanalyseParams = {
      gemeente,
      jaar,
      verslagsoort,
      circulaire,
      overhead: route.query.overhead === '1' || route.query.overhead === 'true'
    }
    handoffStarted.value = true
    await router.replace({ path: `/chat/${state.routeId}` })
    await analyseBegrotingsanalyse(params)
  },
  { immediate: true }
)

watch(conversationId, (id) => {
  const currentId = typeof route.params.id === 'string' ? route.params.id : ''
  if (id && id !== currentId) {
    router.replace(`/chat/${id}`)
  }
})

async function submitPrompt(prompt?: string) {
  const message = (prompt ?? input.value).trim()
  if (!message || isStreaming.value) {
    return
  }

  input.value = ''
  await sendMessage({ message })
}

function onSubmit() {
  submitPrompt()
}

function startNewChat() {
  stopStreaming()
  clearMessages()
  input.value = ''
  router.push('/chat')
}

defineShortcuts({
  meta_o: startNewChat
})

useSeoMeta({
  title: 'Chat',
  description: 'Stel vragen over gemeentelijke kengetallen.'
})
</script>

<template>
  <UDashboardPanel
    id="chat"
    class="relative min-h-0 flex flex-col"
    :ui="{ body: 'flex min-h-0 flex-1 flex-col p-0 sm:p-0 overscroll-none' }"
  >
    <template #header>
      <ChatNavbar
        :title="pageTitle"
        @new-chat="startNewChat"
      />
    </template>

    <template #body>
      <div
        v-if="loadingConversation"
        class="flex flex-1 items-center justify-center text-sm text-muted"
      >
        Gesprek laden...
      </div>

      <UContainer
        v-else-if="!hasMessages"
        class="flex flex-1 flex-col justify-center gap-4 py-8 sm:gap-6"
      >
        <h1 class="text-3xl font-bold text-highlighted sm:text-4xl">
          {{ greeting }}
        </h1>

        <p class="max-w-2xl text-muted">
          Stel vragen over Nederlandse gemeentelijke begrotingsgegevens, kengetallen en rekenmodelcijfers.
        </p>

        <UChatPrompt
          v-model="input"
          :status="status"
          :error="chatError"
          color="neutral"
          variant="subtle"
          placeholder="Stel een vraag over kengetallen..."
          class="[view-transition-name:chat-prompt]"
          :ui="{ base: 'px-1.5' }"
          @submit="onSubmit"
        >
          <template #footer>
            <UChatPromptSubmit
              :status="status"
              color="neutral"
              size="sm"
              @stop="stopStreaming()"
            />
          </template>
        </UChatPrompt>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="quickChat in quickChats"
            :key="quickChat.label"
            :icon="quickChat.icon"
            :label="quickChat.label"
            size="sm"
            color="neutral"
            variant="outline"
            class="rounded-full"
            @click="submitPrompt(quickChat.label)"
          />
        </div>
      </UContainer>

      <UContainer
        v-else
        class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-6"
      >
        <UChatMessages
          should-auto-scroll
          :messages="uiMessages"
          :status="status"
          :spacing-offset="200"
          class="min-h-0 flex-1 overflow-y-auto pt-(--ui-header-height) pb-4 sm:pb-6"
        >
          <template #indicator>
            <div class="flex items-center gap-1.5">
              <ChatIndicator />

              <UChatShimmer
                text="Aan het nadenken..."
                class="text-sm"
              />
            </div>
          </template>

          <template #content="{ message }">
            <div class="space-y-4">
              <ChatMessageWidget
                v-for="(widget, widgetIndex) in widgetsForMessage(message.id)"
                :key="`${message.id}-widget-${widgetIndex}`"
                :widget="widget"
              />

              <template
                v-for="(part, index) in message.parts"
                :key="`${message.id}-${part.type}-${index}`"
              >
                <MDC
                  v-if="isTextUIPart(part) && part.text"
                  :value="part.text"
                  :cache-key="`${message.id}-${index}-${part.text.length}`"
                  class="chat-markdown *:first:mt-0 *:last:mb-0"
                />
              </template>
            </div>
          </template>
        </UChatMessages>

        <UChatPrompt
          v-model="input"
          :status="status"
          :error="chatError"
          color="neutral"
          variant="subtle"
          placeholder="Stel een vervolgvraag..."
          class="sticky bottom-0 z-10 [view-transition-name:chat-prompt] rounded-b-none"
          :ui="{ base: 'px-1.5' }"
          @submit="onSubmit"
        >
          <template #footer>
            <UChatPromptSubmit
              :status="status"
              color="neutral"
              size="sm"
              @stop="stopStreaming()"
            />
          </template>
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.chat-markdown :deep(h2) {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
}

.chat-markdown :deep(h3) {
  margin-top: 0.75rem;
  margin-bottom: 0.25rem;
  font-size: 1rem;
  font-weight: 600;
}

.chat-markdown :deep(ul) {
  margin: 0.25rem 0 0.75rem;
  list-style: disc;
  padding-left: 1.25rem;
}

.chat-markdown :deep(li) {
  margin: 0.15rem 0;
}

.chat-markdown :deep(p) {
  margin: 0.35rem 0;
}
</style>
