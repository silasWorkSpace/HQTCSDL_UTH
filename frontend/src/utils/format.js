export function formatDateTime(value, lang = 'vi') {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
