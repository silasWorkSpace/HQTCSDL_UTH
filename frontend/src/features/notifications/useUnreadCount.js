import { useQuery } from '@tanstack/react-query'
import { notificationApi } from '../../services/notificationApi'

// So thong bao chua doc cho chuong tren header. Loi (ke ca khi notification-service chua chay) thi coi nhu 0, khong bao loi.
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      try {
        const list = await notificationApi.list({ unread: true, size: 50 })
        return list.length
      } catch {
        return 0
      }
    },
    refetchInterval: 60_000,
  })
}
