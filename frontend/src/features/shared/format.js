/** Định dạng ngày giờ theo ngôn ngữ đang chọn (NFR-USAB-04). Giá trị rỗng hoặc sai trả về chuỗi rỗng. */
export function formatDateTime(value, locale = 'vi') {
  if (value == null || value === '') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

/** 'Pending Developer Action' -> 'pending_developer_action', dùng làm khóa i18n. */
export function slug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** 8 ký tự đầu của UUID, dùng khi chưa có tên hiển thị. */
export function shortId(id) {
  return id ? String(id).slice(0, 8) : ''
}
