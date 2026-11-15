import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenStore } from './tokenStore'

describe('tokenStore', () => {
  beforeEach(() => tokenStore.clear())

  it('access token chi o bo nho, refresh token o sessionStorage', () => {
    tokenStore.setAccess('a1')
    tokenStore.setRefresh('r1')
    expect(tokenStore.getAccess()).toBe('a1')
    expect(sessionStorage.getItem('ld.refreshToken')).toBe('r1')
    expect(localStorage.getItem('ld.refreshToken')).toBeNull()
  })

  it('bao cho nguoi dang ky khi doi token va khi xoa', () => {
    const listener = vi.fn()
    const unsubscribe = tokenStore.subscribe(listener)
    tokenStore.setAccess('a2')
    tokenStore.clear()
    expect(listener).toHaveBeenNthCalledWith(1, 'a2')
    expect(listener).toHaveBeenNthCalledWith(2, null)
    unsubscribe()
    tokenStore.setAccess('a3')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
