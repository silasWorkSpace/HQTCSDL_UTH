import { Alert, Button, Card, Empty, Result, Skeleton, Space, Table, Tabs, Tag, Timeline, Typography } from 'antd'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import DiffViewer from '../../components/DiffViewer'
import DocStatusBadges from '../../components/DocStatusBadges'
import EvidencePanel from '../../components/EvidencePanel'
import MarkdownView from '../../components/MarkdownView'
import SeverityBadge from '../../components/SeverityBadge'
import { useDriftAlerts } from '../suggestions/hooks'
import { formatDateTime, slug } from '../shared/format'
import AuditTrail from './AuditTrail'
import DecisionPanel from './DecisionPanel'
import { useReviewDetail } from './hooks'
import { personLabel } from './model'
import useCurrentUser from './useCurrentUser'

function CommentList({ comments = [] }) {
  const { t, i18n } = useTranslation()
  const list = Array.isArray(comments) ? comments : []
  if (list.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reviews.page.commentsEmpty')} />
  }
  return (
    <Table
      size="small"
      pagination={false}
      scroll={{ x: 'max-content' }}
      rowKey={(row) => `${row.userId}-${row.createdAt}-${row.content}`}
      dataSource={list}
      columns={[
        { title: t('reviews.audit.who'), key: 'who', render: (_, row) => personLabel(row.userName, row.userId) },
        { title: t('reviews.page.commentsTitle'), key: 'content', render: (_, row) => (row.lineNumber ? `[${t('reviews.page.line', { line: row.lineNumber })}] ${row.content}` : row.content) },
        { title: t('reviews.audit.when'), dataIndex: 'createdAt', render: (v) => formatDateTime(v, i18n.language) },
      ]}
    />
  )
}

/** Màn hình duyệt: nội dung, so sánh, change log, bằng chứng, audit trail và quyết định (WF-03 đến 07, 13, 20, 22). */
export default function ReviewPage() {
  const { taskId } = useParams()
  const { t, i18n } = useTranslation()
  const user = useCurrentUser()
  const query = useReviewDetail(taskId)
  const alerts = useDriftAlerts(query.data?.task?.documentId)

  if (query.isPending) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }

  if (query.isError || !query.data || !query.data.task) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
        <Result
          status="error"
          title={t('reviews.page.error.title') || 'Không thể tải chi tiết duyệt'}
          subTitle={query.error?.detail || query.error?.message || query.error?.response?.data?.detail || 'Không tìm thấy thông tin task duyệt.'}
          extra={
            <Space>
              <Button type="primary" onClick={() => query.refetch()}>{t('workflow.retry') || 'Thử lại'}</Button>
              <Link to="/reviews">
                <Button>{t('reviews.page.back') || 'Về hàng đợi'}</Button>
              </Link>
            </Space>
          }
        />
      </div>
    )
  }

  const {
    task = {},
    document = null,
    version = null,
    changeLog = [],
    lastApproved = null,
    decisions = [],
    comments = [],
  } = query.data

  const title = task?.documentTitle || document?.title || task?.documentId || 'Tài liệu duyệt'
  const canSeeAudit = (user?.roles || []).includes('Manager') || (user?.roles || []).includes('Administrator')
  const level = String(task?.level || '').toLowerCase()

  const tabs = [
    {
      key: 'content',
      label: t('reviews.page.tabs.content'),
      children: version?.content ? <MarkdownView content={version.content} /> : <Alert type="info" showIcon message={t('reviews.page.noVersion')} />,
    },
    {
      key: 'diff',
      label: t('reviews.page.tabs.diff'),
      children: lastApproved ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">{t('reviews.page.diffNote')}</Typography.Text>
          <DiffViewer oldText={lastApproved?.content ?? ''} newText={version?.content ?? ''} />
        </Space>
      ) : (
        <Alert type="info" showIcon message={t('reviews.page.noApproved')} />
      ),
    },
    {
      key: 'changeLog',
      label: t('reviews.page.tabs.changeLog'),
      children:
        (changeLog || []).length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reviews.page.changeLogEmpty')} />
        ) : (
          <Timeline
            items={(changeLog || []).map((v) => ({
              key: v.id,
              children: (
                <div>
                  <strong>{t('reviews.page.version', { no: v.versionNo })}</strong>{' '}
                  <Tag>{t('reviews.page.by', { role: v.actorRole })}</Tag>
                  {v.changeSource && <Tag>{v.changeSource}</Tag>}
                  <div><Typography.Text type="secondary">{formatDateTime(v.createdAt, i18n.language)}</Typography.Text></div>
                </div>
              ),
            }))}
          />
        ),
    },
    {
      key: 'evidence',
      label: t('reviews.page.tabs.evidence'),
      children: (alerts.isLoading || alerts.isPending) ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (alerts.data ?? []).length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reviews.page.evidenceEmpty')} />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {(alerts.data || []).map((alert) => (
            <Card key={alert.id} size="small" title={
              <Space wrap>
                <Tag>{t(`suggestions.history.types.${slug(alert.driftType)}`, { defaultValue: alert.driftType })}</Tag>
                <SeverityBadge severity={alert.severity} compact />
              </Space>
            }>
              <EvidencePanel evidence={alert.evidence} />
            </Card>
          ))}
        </Space>
      ),
    },
  ]
  if (canSeeAudit) {
    tabs.push({ key: 'audit', label: t('reviews.page.tabs.audit'), children: <AuditTrail decisions={decisions || []} /> })
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Link to="/reviews" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('reviews.page.back')}
        </Link>

        <div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>{title}</Typography.Title>
          <Space wrap>
            <Tag color="blue">{t(`reviews.page.level.${level}`, { defaultValue: task.level })}</Tag>
            <Tag>{t(`reviews.page.taskStatus.${slug(task.status)}`, { defaultValue: task.status })}</Tag>
            <Typography.Text type="secondary">
              {t('reviews.page.submittedBy', { name: personLabel(task.submitterName, task.submitterId) })}
            </Typography.Text>
            {task.docStatus && (
              <Space size={4}>
                <Typography.Text type="secondary">{t('reviews.decision.result')}:</Typography.Text>
                <DocStatusBadges docStatus={task.docStatus} />
              </Space>
            )}
          </Space>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 480px', minWidth: 0 }}>
            <Tabs items={tabs} />
            <Card size="small" title={t('reviews.page.commentsTitle')} style={{ marginTop: 16 }}>
              <CommentList comments={comments || []} />
            </Card>
          </div>
          <div style={{ flex: '0 0 340px', maxWidth: '100%' }}>
            <DecisionPanel task={task} user={user} />
          </div>
        </div>
      </Space>
    </div>
  )
}
