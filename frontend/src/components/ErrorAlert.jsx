import { Alert, Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { toUserError } from '../utils/errors'

// Hien loi theo chuan chung: tieu de + chi tiet + cach khac phuc (NFR-USAB-05).
export default function ErrorAlert({ error, onRetry }) {
  const { t } = useTranslation()
  const info = toUserError(error)
  return (
    <Alert
      type="error"
      showIcon
      message={info.title}
      description={
        <>
          <div>{info.detail}</div>
          <div>{info.hint}</div>
        </>
      }
      action={onRetry ? <Button size="small" onClick={onRetry}>{t('common.actions.retry')}</Button> : null}
      style={{ marginBottom: 16 }}
    />
  )
}
