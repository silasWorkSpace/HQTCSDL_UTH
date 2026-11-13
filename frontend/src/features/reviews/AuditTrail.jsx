import { Empty, Table, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../shared/format'
import { personLabel } from './model'

/** Audit trail (WF-20): ai, khi nào, quyết định gì và lý do. Hiển thị cho Manager trong màn hình duyệt. */
export default function AuditTrail({ decisions }) {
  const { t, i18n } = useTranslation()

  const columns = [
    { title: t('reviews.audit.who'), key: 'who', render: (_, row) => personLabel(row.reviewerName, row.reviewerId) },
    { title: t('reviews.audit.when'), dataIndex: 'decidedAt', render: (v) => formatDateTime(v, i18n.language) },
    {
      title: t('reviews.audit.decision'),
      dataIndex: 'decision',
      render: (d) => <Tag>{t(`reviews.decision.options.${d}`, { defaultValue: d })}</Tag>,
    },
    {
      title: t('reviews.audit.reason'),
      dataIndex: 'reason',
      render: (reason) => reason || <Typography.Text type="secondary">{t('reviews.audit.noReason')}</Typography.Text>,
    },
  ]

  return (
    <Table
      size="small"
      rowKey={(row) => `${row.reviewerId}-${row.decidedAt}-${row.decision}`}
      columns={columns}
      dataSource={decisions}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reviews.audit.empty')} /> }}
    />
  )
}
