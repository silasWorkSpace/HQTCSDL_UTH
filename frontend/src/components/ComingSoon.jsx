import { Result } from 'antd'
import { useTranslation } from 'react-i18next'
import PageHeader from './PageHeader'

// Trang giu cho cac man hinh cua nguoi khac. Nguoi phu trach thay the file trang trong features/<ten>/.
export default function ComingSoon({ titleKey, owner }) {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t(titleKey)} />
      <Result status="info" title={t('placeholder.title')} subTitle={`${t('placeholder.description')} ${t('placeholder.owner', { owner })}`} />
    </>
  )
}
