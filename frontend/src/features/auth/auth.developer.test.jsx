import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { RouterProvider } from 'react-router-dom'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { handlers } from '../../mocks/handlers'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('Developer: phan quyen giao dien', () => {
  it('khong thay menu quan tri va bi chan khi vao thang duong dan quan tri', async () => {
    window.history.pushState({}, '', '/')
    const { default: Providers } = await import('../../app/providers')
    const { router } = await import('../../app/router')
    const user = userEvent.setup()
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    )

    await user.type(await screen.findByLabelText('Mã workspace'), 'demo')
    await user.type(screen.getByLabelText('Email'), 'developer@example.com')
    await user.type(screen.getByLabelText('Mật khẩu'), 'Passw0rd!23')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByRole('menuitem', { name: /Repo GitHub/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Người dùng và vai trò/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Duyệt tài liệu/ })).not.toBeInTheDocument()

    await act(async () => {
      await router.navigate('/admin/users')
    })
    expect(await screen.findByText('Không đủ quyền')).toBeInTheDocument()
  })

  it('sai mat khau thi hien thong bao loi kem cach khac phuc', async () => {
    window.history.pushState({}, '', '/login')
    const { default: Providers } = await import('../../app/providers')
    const { router } = await import('../../app/router')
    const user = userEvent.setup()
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    )
    // Developer o test truoc da dang nhap trong cung module, dang xuat de thu dang nhap sai
    if (!screen.queryByLabelText('Mã workspace')) {
      await user.click(await screen.findByRole('button', { name: /developer@example.com/ }))
      await user.click(await screen.findByText('Đăng xuất'))
    }
    await user.type(await screen.findByLabelText('Mã workspace'), 'demo')
    await user.type(screen.getByLabelText('Email'), 'developer@example.com')
    await user.type(screen.getByLabelText('Mật khẩu'), 'SaiMatKhau!999')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByText('Email hoặc mật khẩu không đúng.')).toBeInTheDocument()
    expect(screen.getByText(/Hãy đăng nhập lại/)).toBeInTheDocument()
  })
})
