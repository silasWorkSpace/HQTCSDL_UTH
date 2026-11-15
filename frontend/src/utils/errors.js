import i18n from '../i18n'

// Doi loi cua axios (backend tra Problem Details: title, detail, errors) thanh thong bao
// co cach khac phuc (NFR-USAB-05). Dung ham nay o MOI man hinh, khong tu viet thong bao loi.
export function toUserError(error) {
  const response = error?.response
  const status = response?.status
  const data = response && typeof response.data === 'object' ? response.data : null

  let hintKey = 'errors.hint.unknown'
  if (!response) hintKey = 'errors.hint.network'
  else if (status === 400) hintKey = 'errors.hint.validation'
  else if (status === 401) hintKey = 'errors.hint.unauthorized'
  else if (status === 403) hintKey = 'errors.hint.forbidden'
  else if (status === 404) hintKey = 'errors.hint.notFound'
  else if (status === 409) hintKey = 'errors.hint.conflict'
  else if (status >= 500) hintKey = 'errors.hint.server'

  return {
    status,
    title: data?.title ?? i18n.t('errors.generic'),
    detail: data?.detail ?? (response ? i18n.t('errors.generic') : i18n.t('errors.network')),
    hint: i18n.t(hintKey),
    fieldErrors: data?.errors && typeof data.errors === 'object' ? data.errors : null,
  }
}
