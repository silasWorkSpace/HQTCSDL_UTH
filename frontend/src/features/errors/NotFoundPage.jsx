import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title={t('errors.notFound.title')}
      subTitle={t('errors.notFound.subtitle')}
      extra={<Button type="primary" onClick={() => navigate('/')}>{t('errors.backHome')}</Button>}
    />
  )
}
