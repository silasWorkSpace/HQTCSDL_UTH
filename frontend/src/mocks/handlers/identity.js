import { delay, http, HttpResponse } from 'msw'

// Dữ liệu giả cho identity-service. Mật khẩu chung của mọi tài khoản mẫu: Passw0rd!23
// Đăng nhập thử các vai trò: admin@, developer@, staff@, manager@, techlead@  (@example.com)
export const MOCK_PASSWORD = 'Passw0rd!23'

let users = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.com', displayName: 'Admin Mẫu', status: 'active', language: 'vi', roles: ['Administrator'] },
  { id: '22222222-2222-4222-8222-222222222222', email: 'developer@example.com', displayName: 'Developer Mẫu', status: 'active', language: 'vi', roles: ['Developer'] },
  { id: '33333333-3333-4333-8333-333333333333', email: 'staff@example.com', displayName: 'Staff Mẫu', status: 'active', language: 'vi', roles: ['Staff'] },
  { id: '44444444-4444-4444-8444-444444444444', email: 'manager@example.com', displayName: 'Manager Mẫu', status: 'active', language: 'vi', roles: ['Manager'] },
  { id: '55555555-5555-4555-8555-555555555555', email: 'techlead@example.com', displayName: 'TechLead Mẫu', status: 'active', language: 'vi', roles: ['TechLead'] },
]

function b64url(object) {
  return btoa(JSON.stringify(object)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

// JWT giả: không có chữ ký thật, chỉ đủ để giao diện đọc claim.
function fakeJwt(user, tenant) {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: 'livingdocs',
    sub: user.id,
    email: user.email,
    tenant,
    roles: user.roles,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 15 * 60,
  }
  return `${b64url({ alg: 'none' })}.${b64url(claims)}.mock`
}

function tokenPair(user, tenant) {
  return {
    accessToken: fakeJwt(user, tenant),
    refreshToken: `mock-refresh.${user.id}.${tenant}.${crypto.randomUUID()}`,
    tokenType: 'Bearer',
    expiresIn: 900,
  }
}

function problem(status, title, detail) {
  return HttpResponse.json({ type: 'about:blank', title, status, detail }, { status })
}

function claimsOf(request) {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.replace('Bearer ', '')
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(part))
  } catch {
    return null
  }
}

function requireAdmin(request) {
  const claims = claimsOf(request)
  if (!claims) return { error: problem(401, 'Chưa đăng nhập', 'Thiếu hoặc sai token.') }
  if (!claims.roles?.includes('Administrator')) {
    return { error: problem(403, 'Không đủ quyền', 'Bạn không có quyền thực hiện thao tác này.') }
  }
  return { claims }
}

export const handlers = [
  http.post('/api/v1/auth/login', async ({ request }) => {
    await delay(200)
    const { tenant, email, password } = await request.json()
    const user = users.find((u) => u.email === String(email).trim().toLowerCase())
    if (!user || password !== MOCK_PASSWORD) {
      return problem(401, 'Đăng nhập thất bại', 'Email hoặc mật khẩu không đúng.')
    }
    return HttpResponse.json(tokenPair(user, tenant))
  }),

  http.post('/api/v1/auth/register', async ({ request }) => {
    await delay(200)
    const { email, displayName } = await request.json()
    const normalized = String(email).trim().toLowerCase()
    if (users.some((u) => u.email === normalized)) {
      return problem(409, 'Email đã được dùng', 'Email này đã đăng ký trong workspace.')
    }
    const user = { id: crypto.randomUUID(), email: normalized, displayName, status: 'active', language: 'vi', roles: ['Developer'] }
    users = [...users, user]
    return HttpResponse.json(user, { status: 201 })
  }),

  http.post('/api/v1/auth/refresh', async ({ request }) => {
    const { refreshToken } = await request.json()
    const [, userId, tenant] = String(refreshToken).split('.')
    const user = users.find((u) => u.id === userId)
    if (!user) return problem(401, 'Phiên hết hạn', 'Refresh token không hợp lệ hoặc đã hết hạn.')
    return HttpResponse.json(tokenPair(user, tenant))
  }),

  http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/v1/users/me', ({ request }) => {
    const claims = claimsOf(request)
    const user = users.find((u) => u.id === claims?.sub)
    if (!user) return problem(401, 'Chưa đăng nhập', 'Thiếu hoặc sai token.')
    return HttpResponse.json(user)
  }),

  http.get('/api/v1/admin/users', async ({ request }) => {
    const { error } = requireAdmin(request)
    if (error) return error
    await delay(150)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 0)
    const size = Number(url.searchParams.get('size') ?? 20)
    return HttpResponse.json(users.slice(page * size, page * size + size))
  }),

  http.put('/api/v1/admin/users/:id/roles', async ({ request, params }) => {
    const { error } = requireAdmin(request)
    if (error) return error
    const { roles } = await request.json()
    const user = users.find((u) => u.id === params.id)
    if (!user) return problem(404, 'Không tìm thấy người dùng', 'Người dùng không tồn tại.')
    user.roles = roles
    return HttpResponse.json(user)
  }),

  http.put('/api/v1/admin/users/:id/status', async ({ request, params }) => {
    const { error } = requireAdmin(request)
    if (error) return error
    const { status } = await request.json()
    const user = users.find((u) => u.id === params.id)
    if (!user) return problem(404, 'Không tìm thấy người dùng', 'Người dùng không tồn tại.')
    user.status = status
    return new HttpResponse(null, { status: 204 })
  }),
]
