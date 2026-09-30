export default defineNuxtRouteMiddleware(async (to) => {
  const { ensureSession } = useAuth()
  const loggedIn = await ensureSession()

  if (to.path === '/login') {
    if (loggedIn) {
      return navigateTo(safeRedirect(to.query.redirect))
    }
    return
  }

  if (to.path === '/') {
    return
  }

  if (!loggedIn) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
