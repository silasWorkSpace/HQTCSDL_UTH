import { Button, Empty, Result, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import DocStatusBadges from '../../components/DocStatusBadges'
import { formatDateTime } from '../shared/format'
import { useReviewQueue } from './hooks'
import { personLabel, queueLevelsFor } from './model'
import useCurrentUser from './useCurrentUser'

function ReviewQueueTable({ level }) {
  const { t, i18n } = useTranslation()
  const query = useReviewQueue(level)

  if (query.isPending) return <Skeleton active paragraph={{ rows: 5 }} />
  if (query.isError) {
    return (
      <Result
        status="error"
        title={t('reviews.error.title')}
        subTitle={query.error?.response?.data?.detail}
        extra={<Button type="primary" onClick={() => query.refetch()}>{t('workflow.retry')}</Button>}
      />
    )
  }

  const columns = [
    {
      title: t('reviews.columns.document'),
      dataIndex: 'documentTitle',
      render: (title, row) => <Link to={`/reviews/${row.id}`}>{title || row.documentId}</Link>,
    },
    { title: t('reviews.columns.submitter'), key: 'submitter', render: (_, row) => personLabel(row.submitterName, row.submitterId) },
    { title: t('reviews.columns.docStatus'), dataIndex: 'docStatus', render: (s) => (s ? <DocStatusBadges docStatus={s} /> : <Tag>—</Tag>) },
    { title: t('reviews.columns.createdAt'), dataIndex: 'createdAt', render: (v) => formatDateTime(v, i18n.language) },
    {
      title: t('reviews.columns.action'),
      key: 'action',
      render: (_, row) => (
        <Link to={`/reviews/${row.id}`}>
          <Button size="small">{t('reviews.open')}</Button>
        </Link>
      ),
    },
  ]

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={query.data}
      scroll={{ x: 'max-content' }}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      locale={{ emptyText: <Empty description={<><strong>{t('reviews.empty.title')}</strong><br />{t('reviews.empty.description')}</>} /> }}
    />
  )
}

/** Hàng đợi duyệt: hai tab chờ Staff và chờ Manager, mỗi vai trò chỉ thấy tab của mình (WF-01, 12). */
export default function ReviewQueuePage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const levels = queueLevelsFor(user.roles)

  if (levels.length === 0) {
    return <Result status="403" title={t('reviews.noAccess.title')} subTitle={t('reviews.noAccess.description')} />
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>{t('reviews.title')}</Typography.Title>
        <Typography.Text type="secondary">{t('reviews.subtitle')}</Typography.Text>
      </div>
      <Tabs
        items={levels.map((level) => ({
          key: level,
          label: t(`reviews.tabs.${level}`),
          children: <ReviewQueueTable level={level} />,
        }))}
      />
    </Space>
  )
}
