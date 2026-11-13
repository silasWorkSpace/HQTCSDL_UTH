/**
 * Chuyển lỗi axios (Problem Details: title, detail, errors) thành thông báo có cách khắc phục
 * (NFR-USAB-05). Nếu Người 1 đã có hàm ánh xạ lỗi dùng chung thì thay hàm này bằng hàm đó.
 */
const HINT_BY_STATUS = { 400: 'hint400', 401: 'hint401', 403: 'hint403', 404: 'hint404', 409: 'hint409' }

export function problemMessage(error, t) {
  const status = error?.response?.status
  const detail = error?.response?.data?.detail
  if (!error?.response) return t('workflow.errors.network')
  const hintKey = HINT_BY_STATUS[status] ?? 'hintDefault'
  const base = detail || t('workflow.errors.generic')
  return `${base} ${t(`workflow.errors.${hintKey}`)}`.trim()
}
