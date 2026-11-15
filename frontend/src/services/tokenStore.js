// Access token chi giu trong bo nho. Refresh token giu trong sessionStorage (mat khi dong tab).
// Nang cap len cookie httpOnly sau khi backend ho tro.
const REFRESH_KEY = 'ld.refreshToken'

let accessToken = null
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener(accessToken))
}

export const tokenStore = {
  getAccess: () => accessToken,
  setAccess(token) {
    accessToken = token
    notify()
  },
  getRefresh: () => sessionStorage.getItem(REFRESH_KEY),
  setRefresh(token) {
    if (token) sessionStorage.setItem(REFRESH_KEY, token)
    else sessionStorage.removeItem(REFRESH_KEY)
  },
  clear() {
    accessToken = null
    sessionStorage.removeItem(REFRESH_KEY)
    notify()
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
