interface AuthUser {
  id: number
  username: string
}

const ACCESS_MAX_AGE = 60 * 60 * 8
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7

let refreshPromise: Promise<boolean> | null = null

function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'statusCode' in error
    && (error as { statusCode?: number }).statusCode === 401
}

export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/chat'
  }
  return value
}

export function useAuth() {
  const config = useRuntimeConfig()
  const accessToken = useCookie<string | null>('fin-monitor-access-token', {
    sameSite: 'lax',
    secure: !import.meta.dev,
    maxAge: ACCESS_MAX_AGE
  })
  const refreshToken = useCookie<string | null>('fin-monitor-refresh-token', {
    sameSite: 'lax',
    secure: !import.meta.dev,
    maxAge: REFRESH_MAX_AGE
  })
  const user = useState<AuthUser | null>('auth-user', () => null)

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    useState<unknown[]>('chat-stream-messages', () => []).value = []
    useState<string | null>('chat-conversation-id', () => null).value = null
    useState<boolean>('chat-stream-is-streaming', () => false).value = false
    useState<unknown[]>('chat-conversations', () => []).value = []
  }

  function authHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra)
    if (accessToken.value) {
      headers.set('Authorization', `Bearer ${accessToken.value}`)
    }
    return headers
  }

  async function doRefresh(): Promise<boolean> {
    if (!refreshToken.value) {
      return false
    }
    try {
      const payload = await $fetch<{ access: string }>(`${config.public.apiBase}/api/token/refresh/`, {
        method: 'POST',
        body: { refresh: refreshToken.value }
      })
      accessToken.value = payload.access
      return true
    } catch (error) {
      if (isUnauthorized(error)) {
        clearSession()
      }
      return false
    }
  }

  function refreshAccess(): Promise<boolean> {
    if (!refreshToken.value) {
      return Promise.resolve(false)
    }
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null
      })
    }
    return refreshPromise
  }

  async function fetchMe() {
    user.value = await $fetch<AuthUser>(`${config.public.apiBase}/api/me/`, {
      headers: { Authorization: `Bearer ${accessToken.value}` }
    })
  }

  async function ensureSession(): Promise<boolean> {
    if (user.value && accessToken.value) {
      return true
    }
    if (!accessToken.value) {
      if (!refreshToken.value) {
        return false
      }
      const refreshed = await refreshAccess()
      if (!refreshed) {
        return false
      }
    }
    try {
      await fetchMe()
      return true
    } catch (error) {
      if (!isUnauthorized(error)) {
        return false
      }
      const refreshed = await refreshAccess()
      if (!refreshed) {
        return false
      }
      try {
        await fetchMe()
        return true
      } catch {
        clearSession()
        return false
      }
    }
  }

  async function login(username: string, password: string) {
    const tokens = await $fetch<{ access: string, refresh: string }>(`${config.public.apiBase}/api/token/`, {
      method: 'POST',
      body: { username, password }
    })
    accessToken.value = tokens.access
    refreshToken.value = tokens.refresh
    await fetchMe()
  }

  function logout() {
    clearSession()
  }

  async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const send = () => fetch(input, {
      ...init,
      headers: authHeaders(init.headers)
    })
    const response = await send()
    if (response.status !== 401) {
      return response
    }
    const refreshed = await refreshAccess()
    if (!refreshed) {
      if (!accessToken.value && import.meta.client) {
        await navigateTo('/login')
      }
      return response
    }
    return send()
  }

  async function authedFetch(request: Parameters<typeof $fetch>[0], options?: Parameters<typeof $fetch>[1]) {
    const run = () => $fetch(request, {
      ...options,
      headers: authHeaders(options?.headers as HeadersInit | undefined)
    })
    try {
      return await run()
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error
      }
      const refreshed = await refreshAccess()
      if (!refreshed) {
        if (!accessToken.value && import.meta.client) {
          await navigateTo('/login')
        }
        throw error
      }
      return await run()
    }
  }

  return {
    user,
    login,
    logout,
    ensureSession,
    apiFetch,
    authedFetch: authedFetch as typeof globalThis.$fetch
  }
}
