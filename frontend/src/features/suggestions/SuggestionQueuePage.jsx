import { Button, Empty, Progress, Result, Segmented, Skeleton, Space, Table, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import SeverityBadge from '../../components/SeverityBadge'
import { formatDateTime, slug } from '../shared/format'
import { ALL_STATUSES, SUGGESTION_STATUS } from './constants'
import { useSuggestions } from './hooks'
import { confidencePercent, sortSuggestions } from './model'
import SuggestionDrawer from './SuggestionDrawer'

const STATUS_COLOR = {
  [SUGGESTION_STATUS.PENDING]: 'processing',
  [SUGGESTION_STATUS.ACCEPTED]: 'success',
  [SUGGESTION_STATUS.DISMISSED]: 'default',
  [SUGGESTION_STATUS.SUPERSEDED]: 'default',
}

export default function SuggestionQueuePage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? SUGGESTION_STATUS.PENDING
  const selectedId = params.get('id')

  const query = useSuggestions(status === ALL_STATUSES ? undefined : status)
  const rows = useMemo(() => sortSuggestions(query.data ?? []), [query.data])
  const selected = rows.find((row) => row.id === selectedId) ?? null

  const update = (mutate) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      mutate(next)
      return next
    })
  const setStatus = (value) => update((p) => { p.set('status', value); p.delete('id') })
  const openRow = (id) => update((p) => p.set('id', id))
  const closeDrawer = () => update((p) => p.delete('id'))

  const columns = [
    {
      title: t('suggestions.columns.document'),
      dataIndex: 'documentTitle',
      render: (title, row) => <Button type="link" onClick={() => openRow(row.id)} style={{ padding: 0 }}>{title || row.documentId}</Button>,
    },
    {
      title: t('suggestions.columns.origin'),
      dataIndex: 'origin',
      render: (origin) => <Tag>{t(`suggestions.origin.${slug(origin)}`, { defaultValue: origin })}</Tag>,
    },
    { title: t('suggestions.columns.severity'), dataIndex: 'topSeverity', render: (s) => <SeverityBadge severity={s} /> },
    {
      title: t('suggestions.columns.confidence'),
      dataIndex: 'confidence',
      render: (c) => (c == null ? '—' : <Progress percent={confidencePercent(c)} size="small" style={{ minWidth: 120 }} />),
    },
    { title: t('suggestions.columns.createdAt'), dataIndex: 'createdAt', render: (v) => formatDateTime(v, i18n.language) },
    {
      title: t('suggestions.columns.status'),
      dataIndex: 'status',
      render: (s) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{t(`suggestions.status.${slug(s)}`, { defaultValue: s })}</Tag>,
    },
    {
      title: t('suggestions.columns.action'),
      key: 'action',
      render: (_, row) => <Button size="small" onClick={() => openRow(row.id)}>{t('suggestions.open')}</Button>,
    },
  ]

  const statusOptions = [
    ...Object.values(SUGGESTION_STATUS).map((value) => ({ value, label: t(`suggestions.status.${slug(value)}`) })),
    { value: ALL_STATUSES, label: t('suggestions.statusAll') },
  ]

  let body
  if (query.isPending) {
    body = <Skeleton active paragraph={{ rows: 6 }} />
  } else if (query.isError) {
    body = (
      <Result
        status="error"
        title={t('suggestions.error.title')}
        subTitle={query.error?.response?.data?.detail}
        extra={<Button type="primary" onClick={() => query.refetch()}>{t('workflow.retry')}</Button>}
      />
    )
  } else {
    body = (
      // Bảng rộng cuộn ngang trong khung riêng, không làm cuộn cả trang (NFR-USAB-01).
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{
          emptyText: (
            <Empty
              description={
                <>
                  <strong>{t('suggestions.empty.title')}</strong>
                  <br />
                  {status === SUGGESTION_STATUS.PENDING ? t('suggestions.empty.pending') : t('suggestions.empty.other')}
                </>
              }
            />
          ),
        }}
      />
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>{t('suggestions.title')}</Typography.Title>
        <Typography.Text type="secondary">{t('suggestions.subtitle')}</Typography.Text>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <Segmented aria-label={t('suggestions.statusFilter')} options={statusOptions} value={status} onChange={setStatus} />
      </div>
      {body}
      <SuggestionDrawer suggestion={selected} onClose={closeDrawer} />
    </Space>
  )
}
