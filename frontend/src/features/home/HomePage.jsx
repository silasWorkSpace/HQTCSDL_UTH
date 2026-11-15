import { Card, Col, Empty, Row } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { APP_ROUTES } from '../../app/routes'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../auth/useAuth'

export default function HomePage() {
  const { t } = useTranslation()
  const { user, hasAnyRole } = useAuth()
  const navigate = useNavigate()

  const features = APP_ROUTES.filter(
    (route) => route.path !== '/' && route.showInMenu !== false && hasAnyRole(route.roles),
  )

  return (
    <>
      <PageHeader title={t('home.welcome', { name: user?.email })} subtitle={t('home.subtitle')} />
      {features.length === 0 ? (
        <Empty description={t('home.noFeatures')} />
      ) : (
        <Row gutter={[16, 16]}>
          {features.map((route) => (
            <Col key={route.path} xs={24} sm={12} lg={8}>
              <Card hoverable onClick={() => navigate(route.path)}>
                <Card.Meta avatar={route.icon} title={t(route.labelKey)} />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  )
}
