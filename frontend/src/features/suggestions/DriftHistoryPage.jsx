import { Button, Empty, Result, Select, Skeleton, Space, Table, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import EvidencePanel from '../../components/EvidencePanel'
import SeverityBadge from '../../components/SeverityBadge'
import { SEVERITIES } from '../../constants/severity'
import { formatDateTime, slug } from '../shared/format'
import { useDriftAlerts, useSuggestions } from './hooks'
import { filterAlerts, uniqueDocuments } from './model'

/** Lịch sử drift (DR-12): cảnh báo đã xử lý của một tài liệu, lọc theo mức và trạng thái. */
export default function DriftHistoryPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const documentId = params.get('documentId')
  const severity = params.get('severity') ?? undefined
  const handlingStatus = params.get('handling') ?? undefined

  const documents = useSuggestions(undefined)
  const alerts = useDriftAlerts(documentId)

  const documentOptions = useMemo(
    () => uniqueDocuments(documents.data ?? []).map((d) => ({ value: d.id, label: d.title })),
    [documents.data],
  )
  const handlingOptions = useMemo(
    () => [...new Set((alerts.data ?? []).map((a) => a.handlingStatus).filter(Boolean))].map((value) => ({ value, label: t(`suggestions.history.handlingStatus.${slug(value)}`, { defaultValue: value }) })),
    [alerts.data, t],
  )
  const rows = useMemo(() => filterAlerts(alerts.data ?? [], { severity, handlingStatus }), [alerts.data, severity, handlingStatus])

  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })

  const columns = [
    { title: t('suggestions.history.columns.createdAt'), dataIndex: 'createdAt', render: (v) => formatDateTime(v, i18n.language) },
    {
      title: t('suggestions.history.columns.driftType'),
      dataIndex: 'driftType',
      render: (type) => <Tag>{t(`suggestions.history.types.${slug(type)}`, { defaultValue: type })}</Tag>,
    },
    { title: t('suggestions.history.columns.severity'), dataIndex: 'severity', render: (s) => <SeverityBadge severity={s} /> },
    {
      title: t('suggestions.history.columns.handling'),
      dataIndex: 'handlingStatus',
      render: (s) => <Tag>{t(`suggestions.history.handlingStatus.${slug(s)}`, { defaultValue: s })}</Tag>,
    },
    {
      title: t('suggestions.history.columns.summary'),
      key: 'summary',
      render: (_, row) => t('suggestions.history.entities', { count: row.evidence.entities.length }),
    },
  ]

  let body
  if (!documentId) {
    body = <Empty description={<><strong>{t('suggestions.history.noDocument.title')}</strong><br />{t('suggestions.history.noDocument.description')}</>} />
  } else if (alerts.isPending) {
    body = <Skeleton active paragraph={{ rows: 5 }} />
  } else if (alerts.isError) {
    body = (
      <Result
        status="error"
        title={t('suggestions.history.error.title')}
        subTitle={alerts.error?.response?.data?.detail}
        extra={<Button type="primary" onClick={() => alerts.refetch()}>{t('workflow.retry')}</Button>}
      />
    )
  } else {
    body = (
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        expandable={{ expandedRowRender: (row) => <EvidencePanel evidence={row.evidence} /> }}
        locale={{ emptyText: <Empty description={<><strong>{t('suggestions.history.empty.title')}</strong><br />{t('suggestions.history.empty.description')}</>} /> }}
      />
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>{t('suggestions.history.title')}</Typography.Title>
        <Typography.Text type="secondary">{t('suggestions.history.subtitle')}</Typography.Text>
      </div>
      <Space wrap>
        <Select
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 260 }}
          placeholder={t('suggestions.history.selectDocument')}
          aria-label={t('suggestions.history.document')}
          options={documentOptions}
          loading={documents.isPending}
          value={documentId ?? undefined}
          onChange={(value) => setParam('documentId', value)}
        />
        <Select
          allowClear
          style={{ minWidth: 160 }}
          placeholder={t('suggestions.history.allSeverities')}
          aria-label={t('suggestions.history.severity')}
          options={SEVERITIES.map((value) => ({ value, label: t(`severity.${value.toLowerCase()}`) }))}
          value={severity}
          onChange={(value) => setParam('severity', value)}
        />
        <Select
          allowClear
          style={{ minWidth: 180 }}
          placeholder={t('suggestions.history.allHandling')}
          aria-label={t('suggestions.history.handling')}
          options={handlingOptions}
          value={handlingStatus}
          onChange={(value) => setParam('handling', value)}
        />
      </Space>
      {body}
    </Space>
  )
}
