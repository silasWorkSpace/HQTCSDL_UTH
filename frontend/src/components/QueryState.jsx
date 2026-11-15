import { Empty, Skeleton } from 'antd'
import ErrorAlert from './ErrorAlert'

// Ba trang thai chuan cua moi man hinh: dang tai (skeleton), loi (co nut thu lai), rong (huong dan).
// Dung voi ket qua cua useQuery. isEmpty do man hinh tu tinh tu du lieu.
export default function QueryState({ query, isEmpty = false, emptyText, children }) {
  if (query.isPending) return <Skeleton active paragraph={{ rows: 4 }} />
  if (query.isError) return <ErrorAlert error={query.error} onRetry={() => query.refetch()} />
  if (isEmpty) return <Empty description={emptyText} />
  return children
}
