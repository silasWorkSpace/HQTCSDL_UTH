import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '../../services/authApi'
import { refreshOnce, setAuthLostHandler } from '../../services/apiClient'
import { tokenStore } from '../../services/tokenStore'
import { decodeJwt } from '../../utils/jwt'

export const AuthContext = createContext(null)

function userFromToken(token) {
  const claims = token ? decodeJwt(token) : null
  if (!claims) return null
  return {
    id: claims.sub,
    email: claims.email,
    tenant: claims.tenant,
    roles: Array.isArray(claims.roles) ? claims.roles : [],
  }
}

export function AuthProvider({ children }) {
  // status: loading (dang khoi phuc phien) | authenticated | anonymous
  const [state, setState] = useState({ status: 'loading', user: null })

  useEffect(() => {
    const apply = (token) => {
      const user = userFromToken(token)
      setState({ status: user ? 'authenticated' : 'anonymous', user })
    }
    const unsubscribe = tokenStore.subscribe(apply)
    setAuthLostHandler(() => tokenStore.clear())

    // Khoi phuc phien sau khi tai lai trang: access token mat, con refresh token trong sessionStorage.
    if (tokenStore.getRefresh()) {
      refreshOnce().catch(() => tokenStore.clear())
    } else {
      apply(null)
    }
    return unsubscribe
  }, [])

  const login = useCallback(async ({ tenant, email, password }) => {
    const { data } = await authApi.login(tenant, email, password)
    localStorage.setItem('ld.tenant', tenant)
    tokenStore.setRefresh(data.refreshToken)
    tokenStore.setAccess(data.accessToken)
  }, [])

  const register = useCallback(async (payload) => {
    await authApi.register(payload)
    localStorage.setItem('ld.tenant', payload.tenant)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout(tokenStore.getRefresh())
    } catch {
      // Loi mang khi dang xuat: van dang xuat cuc bo.
    }
    tokenStore.clear()
  }, [])

  const roles = state.user?.roles
  const hasAnyRole = useCallback(
    (required) => !required || required.length === 0 || required.some((role) => roles?.includes(role)),
    [roles],
  )

  const value = useMemo(
    () => ({ ...state, login, register, logout, hasAnyRole }),
    [state, login, register, logout, hasAnyRole],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
