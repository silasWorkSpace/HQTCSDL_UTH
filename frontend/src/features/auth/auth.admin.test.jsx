import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { RouterProvider } from 'react-router-dom'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { handlers } from '../../mocks/handlers'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('Administrator: dang nhap va quan ly nguoi dung', () => {
  it('dang nhap, thay menu quan tri, doi vai tro mot nguoi dung', async () => {
    window.history.pushState({}, '', '/')
    const { default: Providers } = await import('../../app/providers')
    const { router } = await import('../../app/router')
    const user = userEvent.setup()
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    )

    // Chua dang nhap thi bi dua ve trang dang nhap
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Mã workspace'), 'demo')
    await user.type(screen.getByLabelText('Email'), 'admin@example.com')
    await user.type(screen.getByLabelText('Mật khẩu'), 'Passw0rd!23')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    // Vao trang chu, menu co muc cua Administrator
    const adminMenu = await screen.findByRole('menuitem', { name: /Người dùng và vai trò/ })
    await user.click(adminMenu)

    // Bang nguoi dung hien du lieu
    expect(await screen.findByText('developer@example.com')).toBeInTheDocument()

    // Mo hop thoai doi vai tro cua developer
    const row = screen.getByText('developer@example.com').closest('tr')
    await user.click(row.querySelector('button'))
    expect(await screen.findByText(/Đổi vai trò của developer@example.com/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Staff' })).toBeInTheDocument())
  })
})
