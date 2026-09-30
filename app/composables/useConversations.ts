import type { ConversationDetail, ConversationSummary } from '~/types/chat'

export function useConversations() {
  const config = useRuntimeConfig()
  const { apiFetch } = useAuth()
  const conversations = useState<ConversationSummary[]>('chat-conversations', () => [])
  const pending = useState('chat-conversations-pending', () => false)
  const error = useState<string | null>('chat-conversations-error', () => null)

  function conversationsUrl(id?: string) {
    const base = `${config.public.apiBase}/api/conversations/`
    return id ? `${base}${id}/` : base
  }

  async function parseError(response: Response, fallback: string) {
    const payload = await response.json().catch(() => null)
    if (payload && typeof payload.error === 'string') {
      return payload.error
    }
    return `${fallback} (${response.status})`
  }

  async function refreshConversations() {
    pending.value = true
    error.value = null
    try {
      const response = await apiFetch(conversationsUrl())
      if (!response.ok) {
        throw new Error(await parseError(response, 'Failed to load conversations'))
      }
      const payload = await response.json() as { conversations?: ConversationSummary[] }
      conversations.value = payload.conversations ?? []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load conversations'
      conversations.value = []
    } finally {
      pending.value = false
    }
  }

  async function fetchConversation(id: string): Promise<ConversationDetail> {
    const response = await apiFetch(conversationsUrl(id))
    if (!response.ok) {
      throw new Error(await parseError(response, 'Conversation not found'))
    }
    return await response.json() as ConversationDetail
  }

  async function renameConversation(id: string, title: string) {
    const response = await apiFetch(conversationsUrl(id), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    })
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to rename conversation'))
    }
    const updated = await response.json() as ConversationSummary
    conversations.value = conversations.value.map(item => item.id === id ? updated : item)
    return updated
  }

  async function deleteConversation(id: string) {
    const response = await apiFetch(conversationsUrl(id), {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(await parseError(response, 'Failed to delete conversation'))
    }
    conversations.value = conversations.value.filter(item => item.id !== id)
  }

  return {
    conversations,
    pending,
    error,
    refreshConversations,
    fetchConversation,
    renameConversation,
    deleteConversation
  }
}
