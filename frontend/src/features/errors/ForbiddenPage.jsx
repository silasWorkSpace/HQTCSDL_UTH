import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function ForbiddenPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Result
      status="403"
      title={t('errors.forbidden.title')}
      subTitle={t('errors.forbidden.subtitle')}
      extra={<Button type="primary" onClick={() => navigate('/')}>{t('errors.backHome')}</Button>}
    />
  )
}
