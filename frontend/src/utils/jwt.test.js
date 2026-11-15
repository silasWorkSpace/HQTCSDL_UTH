import { describe, expect, it } from 'vitest'
import { decodeJwt } from './jwt'

function makeToken(claims) {
  const enc = (o) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${enc({ alg: 'HS256' })}.${enc(claims)}.signature`
}

describe('decodeJwt', () => {
  it('doc duoc tenant, roles va email', () => {
    const claims = decodeJwt(makeToken({ sub: 'u1', tenant: 'demo', roles: ['Developer'], email: 'a@b.c' }))
    expect(claims.tenant).toBe('demo')
    expect(claims.roles).toEqual(['Developer'])
  })

  it('doc dung chu co dau', () => {
    const payload = { name: 'Nguyễn Duy Hoàng' }
    const json = new TextEncoder().encode(JSON.stringify(payload))
    const b64 = btoa(String.fromCharCode(...json)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    expect(decodeJwt(`x.${b64}.y`).name).toBe('Nguyễn Duy Hoàng')
  })

  it('tra null khi token hong', () => {
    expect(decodeJwt('khong-phai-jwt')).toBeNull()
    expect(decodeJwt('')).toBeNull()
  })
})
