// Điểm nối duy nhất với phần đăng nhập của Người 1. Cần useAuth() trả { user: { id, roles } }
// (id lấy từ claim sub của JWT, roles là danh sách vai trò). Nếu tên khác, chỉ sửa file này.
import { useAuth } from '../auth/useAuth'

export default function useCurrentUser() {
  const { user } = useAuth()
  return { id: user?.id ?? null, roles: user?.roles ?? [] }
}
