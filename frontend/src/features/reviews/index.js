// Điểm vào của cụm Duyệt. Người 1 chỉ cần nối routes và menu vào router và sidebar.
import { createElement } from 'react'
import ReviewPage from './ReviewPage'
import ReviewQueuePage from './ReviewQueuePage'

const ROLES = ['Staff', 'Manager', 'Administrator']

export const reviewRoutes = [
  { path: 'reviews', element: createElement(ReviewQueuePage), handle: { roles: ROLES } },
  { path: 'reviews/:taskId', element: createElement(ReviewPage), handle: { roles: ROLES } },
]

/** Staff thấy hàng đợi duyệt, Manager thấy hàng đợi phê duyệt (cùng một trang, khác tab). */
export const reviewMenu = [
  { key: 'reviews', path: '/reviews', labelKey: 'reviews.menu', roles: ROLES },
]

export { registerReviewsI18n } from './i18n'
