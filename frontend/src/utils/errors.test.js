import { describe, expect, it } from 'vitest'
import { toUserError } from './errors'

describe('toUserError', () => {
  it('dung title va detail cua Problem Details, kem cach khac phuc theo ma loi', () => {
    const info = toUserError({
      response: { status: 409, data: { title: 'Email đã được dùng', detail: 'Email này đã đăng ký.' } },
    })
    expect(info.title).toBe('Email đã được dùng')
    expect(info.detail).toBe('Email này đã đăng ký.')
    expect(info.hint).toContain('trùng')
  })

  it('lay danh sach loi theo truong khi 400', () => {
    const info = toUserError({ response: { status: 400, data: { errors: { email: 'Email không hợp lệ' } } } })
    expect(info.fieldErrors).toEqual({ email: 'Email không hợp lệ' })
  })

  it('khong co phan hoi thi bao loi mang', () => {
    const info = toUserError(new Error('Network Error'))
    expect(info.status).toBeUndefined()
    expect(info.detail).toContain('Không kết nối')
  })
})
