<script setup lang="ts">
const route = useRoute()
const {
  conversations,
  pending,
  refreshConversations,
  deleteConversation,
  renameConversation
} = useConversations()
const { conversationId, isStreaming, stopStreaming, clearMessages } = useChatStream()

const editingId = ref<string | null>(null)
const draftTitle = ref('')

const activeId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

onMounted(() => {
  refreshConversations()
})

watch(conversationId, (id) => {
  if (id) {
    refreshConversations()
  }
})

function formatUpdatedAt(iso: string) {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) {
    return 'Zojuist'
  }
  if (minutes < 60) {
    return `${minutes}m geleden`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}u geleden`
  }
  const days = Math.round(hours / 24)
  if (days < 7) {
    return `${days}d geleden`
  }
  return date.toLocaleDateString('nl-NL')
}

function startNewChat() {
  if (isStreaming.value) {
    stopStreaming()
  }
  clearMessages()
  navigateTo('/chat')
}

async function openConversation(id: string) {
  if (id === activeId.value) {
    return
  }
  if (isStreaming.value) {
    stopStreaming()
  }
  await navigateTo(`/chat/${id}`)
}

function startRename(id: string, title: string) {
  editingId.value = id
  draftTitle.value = title
}

async function commitRename() {
  const id = editingId.value
  const title = draftTitle.value.trim()
  editingId.value = null
  if (!id || !title) {
    return
  }
  await renameConversation(id, title)
}

async function removeConversation(id: string) {
  await deleteConversation(id)
  if (id === activeId.value || id === conversationId.value) {
    if (isStreaming.value) {
      stopStreaming()
    }
    clearMessages()
    await navigateTo('/chat')
  }
}
</script>

<template>
  <aside class="flex w-64 shrink-0 flex-col border-r border-default bg-default/40">
    <div class="flex flex-col gap-2 border-b border-default p-3">
      <p class="text-sm font-medium text-highlighted">
        Chats
      </p>
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-lucide-plus"
        label="Nieuw gesprek"
        block
        @click="startNewChat"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <p
        v-if="pending && conversations.length === 0"
        class="px-2 py-3 text-xs text-muted"
      >
        Chats laden...
      </p>
      <p
        v-else-if="conversations.length === 0"
        class="px-2 py-3 text-xs text-muted"
      >
        Nog geen chats. Stuur een bericht om er een te starten.
      </p>
      <ul
        v-else
        class="space-y-1"
      >
        <li
          v-for="conversation in conversations"
          :key="conversation.id"
        >
          <div
            class="group flex items-start gap-1 rounded-md px-2 py-2 text-left text-sm"
            :class="conversation.id === activeId ? 'bg-elevated text-highlighted' : 'text-muted hover:bg-elevated/70'"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="openConversation(conversation.id)"
            >
              <input
                v-if="editingId === conversation.id"
                v-model="draftTitle"
                class="w-full rounded border border-default bg-default px-1 py-0.5 text-sm text-highlighted"
                @click.stop
                @keydown.enter.prevent="commitRename"
                @blur="commitRename"
              >
              <span
                v-else
                class="block truncate font-medium"
              >
                {{ conversation.title || 'Nieuw gesprek' }}
              </span>
              <span class="mt-0.5 block text-xs opacity-70">
                {{ formatUpdatedAt(conversation.updated_at) }}
              </span>
            </button>
            <UDropdownMenu
              :items="[{
                label: 'Hernoemen',
                icon: 'i-lucide-pencil',
                onSelect: () => startRename(conversation.id, conversation.title)
              }, {
                label: 'Verwijderen',
                icon: 'i-lucide-trash',
                color: 'error',
                onSelect: () => removeConversation(conversation.id)
              }]"
            >
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-ellipsis"
                size="xs"
                class="opacity-0 group-hover:opacity-100"
                aria-label="Gespreksacties"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </li>
      </ul>
    </div>
  </aside>
</template>
