import { Alert, Card, Descriptions, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import PageHeader from '../../components/PageHeader'
import QueryState from '../../components/QueryState'
import { authApi } from '../../services/authApi'

export default function ProfilePage() {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: ['me'], queryFn: authApi.me })
  const me = query.data

  return (
    <>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      <QueryState query={query}>
        <Card>
          <Descriptions column={1} bordered size="middle">
            <Descriptions.Item label={t('profile.fields.displayName')}>{me?.displayName}</Descriptions.Item>
            <Descriptions.Item label={t('profile.fields.email')}>{me?.email}</Descriptions.Item>
            <Descriptions.Item label={t('profile.fields.roles')}>
              {me?.roles?.map((role) => <Tag key={role} color="blue">{t(`common.role.${role}`)}</Tag>)}
            </Descriptions.Item>
            <Descriptions.Item label={t('profile.fields.status')}>{me?.status}</Descriptions.Item>
            <Descriptions.Item label={t('profile.fields.language')}><LanguageSwitcher /></Descriptions.Item>
            <Descriptions.Item label={t('profile.fields.id')}>{me?.id}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Alert style={{ marginTop: 16 }} type="info" showIcon message={t('profile.note')} />
      </QueryState>
    </>
  )
}
