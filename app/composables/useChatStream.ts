import type { ChatStatus, UIMessage } from 'ai'
import type { BegrotingsanalyseParams } from '~/types/begrotingsanalyse-widget'
import type { ChatWidgetSpec, ConversationDetail } from '~/types/chat'
import { stripMarkdownImages } from '~/utils/chatText'
import { isBegrotingsanalyseChartSpec, cloneBegrotingsanalyseChartSpec } from '~/utils/begrotingsanalyseChart'
import { isFinancialPositionWidgetSpec, cloneFinancialPositionWidgetSpec } from '~/utils/financialPosition'
import { isKengetallenWidgetSpec, cloneKengetallenWidgetSpec } from '~/utils/kengetallenChart'
import { isDataTableWidgetSpec, cloneDataTableWidgetSpec } from '~/utils/dataTable'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  widgets: ChatWidgetSpec[]
}

function isChatWidgetSpec(value: unknown): value is ChatWidgetSpec {
  return isKengetallenWidgetSpec(value)
    || isDataTableWidgetSpec(value)
    || isBegrotingsanalyseChartSpec(value)
    || isFinancialPositionWidgetSpec(value)
}

function cloneChatWidgetSpec(spec: ChatWidgetSpec): ChatWidgetSpec {
  if (isKengetallenWidgetSpec(spec)) {
    return cloneKengetallenWidgetSpec(spec)
  }
  if (isBegrotingsanalyseChartSpec(spec)) {
    return cloneBegrotingsanalyseChartSpec(spec)
  }
  if (isFinancialPositionWidgetSpec(spec)) {
    return cloneFinancialPositionWidgetSpec(spec)
  }
  return cloneDataTableWidgetSpec(spec)
}

export interface ChatRequest {
  message: string
}

interface StreamEvent {
  type: 'conversation' | 'status' | 'token' | 'widget' | 'done' | 'error' | 'user'
  content?: string
  message?: string
  conversation_id?: string
  row_count?: number
  tools_used?: string[]
  has_widget?: boolean
  widget?: ChatWidgetSpec
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toUIMessage(message: ChatMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: stripMarkdownImages(message.content) }]
  }
}

function parseSseLine(line: string): StreamEvent | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data: ')) {
    return null
  }
  try {
    return JSON.parse(trimmed.slice(6)) as StreamEvent
  } catch {
    return null
  }
}

function parseSseEvents(buffer: string, flush = false): { events: StreamEvent[], remainder: string } {
  const events: StreamEvent[] = []
  const parts = buffer.split('\n\n')
  let remainder = parts.pop() ?? ''

  for (const part of parts) {
    const event = parseSseLine(part)
    if (event) {
      events.push(event)
    }
  }

  if (flush && remainder.trim()) {
    const event = parseSseLine(remainder)
    if (event) {
      events.push(event)
    }
    remainder = ''
  }

  return { events, remainder }
}

function ensureAssistantMessage(messages: ChatMessage[]): number {
  const last = messages.at(-1)
  if (last?.role === 'assistant') {
    return messages.length - 1
  }

  messages.push({
    id: createMessageId(),
    role: 'assistant',
    content: '',
    widgets: []
  })
  return messages.length - 1
}

function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(message => ({
    ...message,
    widgets: [...message.widgets]
  }))
}

function applyStreamEvents(
  messages: ChatMessage[],
  events: StreamEvent[],
  assistantIndexRef: { value: number }
) {
  // Apply tokens before widgets so text can render while the chart bundle loads.
  const ordered = [
    ...events.filter(event => event.type === 'token'),
    ...events.filter(event => event.type !== 'token')
  ]

  for (const event of ordered) {
    if (event.type === 'status' || event.type === 'done' || event.type === 'conversation') {
      continue
    }

    if (event.type === 'token' && event.content) {
      assistantIndexRef.value = ensureAssistantMessage(messages)
      const assistant = messages[assistantIndexRef.value]
      if (assistant) {
        assistant.content += event.content
      }
      continue
    }

    if (event.type === 'widget' && event.widget && isChatWidgetSpec(event.widget)) {
      assistantIndexRef.value = ensureAssistantMessage(messages)
      const assistant = messages[assistantIndexRef.value]
      if (assistant) {
        assistant.widgets = [...assistant.widgets, cloneChatWidgetSpec(event.widget)]
      }
      continue
    }

    if (event.type === 'error') {
      throw new Error(event.message ?? 'Stream failed')
    }
  }
}

async function consumeSseResponse(
  response: Response,
  onEvents: (events: StreamEvent[]) => void
) {
  if (!response.body) {
    onEvents(parseSseEvents(await response.text(), true).events)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (value) {
      buffer += decoder.decode(value, { stream: !done })
    }

    const parsed = parseSseEvents(buffer, done)
    buffer = parsed.remainder

    if (parsed.events.length > 0) {
      onEvents(parsed.events)
    }

    if (done) {
      break
    }
  }
}

export function useChatStream() {
  const config = useRuntimeConfig()
  const { apiFetch } = useAuth()
  const messages = useState<ChatMessage[]>('chat-stream-messages', () => [])
  const conversationId = useState<string | null>('chat-conversation-id', () => null)
  const isStreaming = useState('chat-stream-is-streaming', () => false)
  const error = useState<string | null>('chat-stream-error', () => null)

  let abortController: AbortController | null = null

  const uiMessages = computed(() => messages.value.map(toUIMessage))

  const widgetsByMessageId = computed(() => {
    const map = new Map<string, ChatWidgetSpec[]>()
    for (const message of messages.value) {
      map.set(message.id, message.widgets)
    }
    return map
  })

  const status = computed<ChatStatus>(() => {
    if (error.value) {
      return 'error'
    }
    if (isStreaming.value) {
      const lastMessage = messages.value.at(-1)
      if (!lastMessage || lastMessage.role === 'user') {
        return 'submitted'
      }
      if (!lastMessage.content && lastMessage.widgets.length === 0) {
        return 'submitted'
      }
      return 'streaming'
    }
    return 'ready'
  })

  const chatError = computed(() => (error.value ? new Error(error.value) : undefined))

  function widgetsForMessage(messageId: string) {
    return widgetsByMessageId.value.get(messageId) ?? []
  }

  function commitStreamEvents(events: StreamEvent[], assistantIndexRef: { value: number }) {
    if (events.length === 0) {
      return
    }
    const nextMessages = cloneMessages(messages.value)
    applyStreamEvents(nextMessages, events, assistantIndexRef)
    messages.value = nextMessages
  }

  function hydrateConversation(detail: ConversationDetail) {
    conversationId.value = detail.id
    error.value = null
    messages.value = detail.messages.map(message => ({
      id: message.id,
      role: message.role,
      content: message.content,
      widgets: (message.widgets ?? [])
        .filter(isChatWidgetSpec)
        .map(spec => cloneChatWidgetSpec(spec))
    }))
  }

  async function sendMessage(request: ChatRequest) {
    if (isStreaming.value || !request.message.trim()) {
      return
    }

    error.value = null
    isStreaming.value = true
    abortController = new AbortController()

    messages.value = [
      ...messages.value,
      {
        id: createMessageId(),
        role: 'user',
        content: request.message.trim(),
        widgets: []
      }
    ]

    const assistantIndexRef = { value: -1 }

    try {
      const response = await apiFetch(`${config.public.apiBase}/api/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: request.message.trim(),
          conversation_id: conversationId.value
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? `Request failed (${response.status})`)
      }

      await consumeSseResponse(response, (events) => {
        for (const event of events) {
          if (event.type === 'conversation' && event.conversation_id) {
            conversationId.value = event.conversation_id
          }
        }
        commitStreamEvents(events, assistantIndexRef)
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : 'Something went wrong'
      error.value = message
      if (assistantIndexRef.value === -1) {
        messages.value = [
          ...messages.value,
          {
            id: createMessageId(),
            role: 'assistant',
            content: message,
            widgets: []
          }
        ]
      } else {
        const nextMessages = cloneMessages(messages.value)
        const assistant = nextMessages[assistantIndexRef.value]
        if (assistant && !assistant.content) {
          assistant.content = message
        }
        messages.value = nextMessages
      }
    } finally {
      isStreaming.value = false
      abortController = null
    }
  }

  async function analyseBegrotingsanalyse(params: BegrotingsanalyseParams) {
    if (isStreaming.value || !conversationId.value) {
      return
    }

    error.value = null
    isStreaming.value = true
    abortController = new AbortController()
    const assistantIndexRef = { value: -1 }
    let appendedUser = false

    try {
      const response = await apiFetch(
        `${config.public.apiBase}/api/conversations/${conversationId.value}/tools/begrotingsanalyse/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            gemeente: params.gemeente,
            jaar: params.jaar,
            verslagsoort: params.verslagsoort,
            circulaire: params.circulaire,
            overhead: params.overhead
          }),
          signal: abortController.signal
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? `Request failed (${response.status})`)
      }

      await consumeSseResponse(response, (events) => {
        if (!appendedUser) {
          const userEvent = events.find(event => event.type === 'user' && event.content)
          if (userEvent?.content) {
            appendedUser = true
            messages.value = [
              ...messages.value,
              {
                id: createMessageId(),
                role: 'user',
                content: userEvent.content,
                widgets: []
              }
            ]
          }
        }
        commitStreamEvents(
          events.filter(event => event.type !== 'user'),
          assistantIndexRef
        )
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      const message = err instanceof Error ? err.message : 'Something went wrong'
      error.value = message
      if (assistantIndexRef.value === -1) {
        messages.value = [
          ...messages.value,
          {
            id: createMessageId(),
            role: 'assistant',
            content: message,
            widgets: []
          }
        ]
      } else {
        const nextMessages = cloneMessages(messages.value)
        const assistant = nextMessages[assistantIndexRef.value]
        if (assistant && !assistant.content) {
          assistant.content = message
        }
        messages.value = nextMessages
      }
    } finally {
      isStreaming.value = false
      abortController = null
    }
  }

  function stopStreaming() {
    abortController?.abort()
    isStreaming.value = false
  }

  function clearMessages() {
    messages.value = []
    conversationId.value = null
    error.value = null
  }

  return {
    messages,
    conversationId,
    uiMessages,
    widgetsByMessageId,
    status,
    chatError,
    isStreaming,
    error,
    widgetsForMessage,
    hydrateConversation,
    sendMessage,
    analyseBegrotingsanalyse,
    stopStreaming,
    clearMessages
  }
}
