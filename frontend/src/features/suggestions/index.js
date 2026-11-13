// Điểm vào của cụm Gợi ý drift. Người 1 chỉ cần nối routes và menu vào router và sidebar.
import { createElement } from 'react'
import DriftHistoryPage from './DriftHistoryPage'
import SuggestionQueuePage from './SuggestionQueuePage'

const ROLES = ['Developer', 'Administrator']

/** Đường dẫn theo cấu trúc router của React Router; handle.roles dùng cho bảo vệ route theo vai trò. */
export const suggestionRoutes = [
  { path: 'suggestions', element: createElement(SuggestionQueuePage), handle: { roles: ROLES } },
  { path: 'drift-history', element: createElement(DriftHistoryPage), handle: { roles: ROLES } },
]

/** Mục menu theo vai trò (Bảng 11 SRS: Developer thấy hàng đợi gợi ý và drift). */
export const suggestionMenu = [
  { key: 'suggestions', path: '/suggestions', labelKey: 'suggestions.menu.queue', roles: ROLES },
  { key: 'drift-history', path: '/drift-history', labelKey: 'suggestions.menu.history', roles: ROLES },
]

export { registerSuggestionsI18n } from './i18n'
