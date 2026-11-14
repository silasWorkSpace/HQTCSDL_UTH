import { Collapse, Empty, Space, Tag, Typography } from 'antd'
import { FileCode2, GitCommitHorizontal, Ticket } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { hasEvidence, normalizeEvidence } from '../features/suggestions/model'
import SeverityBadge from './SeverityBadge'

const codeStyle = {
  display: 'block',
  margin: 0,
  padding: '6px 8px',
  background: 'rgba(0,0,0,0.04)',
  borderRadius: 4,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 12,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}

function Chip({ icon, label, value }) {
  const Icon = icon
  return (
    <Tag style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={14} aria-hidden="true" />
      <span>{label}:</span>
      <strong>{value}</strong>
    </Tag>
  )
}

/** Bằng chứng của một cảnh báo hoặc gợi ý: tệp, thực thể code, commit, diff, ticket (DR-07). */
export default function EvidencePanel({ evidence }) {
  const { t } = useTranslation()
  const ev = useMemo(() => (evidence && typeof evidence === 'object' && 'entities' in evidence ? evidence : normalizeEvidence(evidence)), [evidence])

  if (!hasEvidence(ev)) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('evidence.empty')} />
  }

  const items = ev.entities.map((entity, index) => ({
    key: String(index),
    label: (
      <Space wrap>
        <strong>{entity.entity}</strong>
        {entity.kind && <Tag>{t(`evidence.kind.${entity.kind}`, { defaultValue: entity.kind })}</Tag>}
        <SeverityBadge severity={entity.severity} compact />
      </Space>
    ),
    children: (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {entity.message && <Typography.Text>{entity.message}</Typography.Text>}
        {entity.sections.length > 0 && (
          <Space wrap size={4}>
            <Typography.Text type="secondary">{t('evidence.sections')}:</Typography.Text>
            {entity.sections.map((s) => (
              <Tag key={s}>{s}</Tag>
            ))}
          </Space>
        )}
        {entity.oldSignature && (
          <div>
            <Typography.Text type="secondary">{t('evidence.oldSignature')}</Typography.Text>
            <code style={codeStyle}>{entity.oldSignature}</code>
          </div>
        )}
        {entity.newSignature && (
          <div>
            <Typography.Text type="secondary">{t('evidence.newSignature')}</Typography.Text>
            <code style={codeStyle}>{entity.newSignature}</code>
          </div>
        )}
      </Space>
    ),
  }))

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {(ev.file || ev.commit || ev.ticket) && (
        <Space wrap size={[4, 4]}>
          {ev.file && <Chip icon={FileCode2} label={t('evidence.file')} value={ev.file} />}
          {ev.commit && <Chip icon={GitCommitHorizontal} label={t('evidence.commit')} value={String(ev.commit).slice(0, 10)} />}
          {ev.ticket && <Chip icon={Ticket} label={t('evidence.ticket')} value={ev.ticket} />}
        </Space>
      )}
      {items.length > 0 && <Collapse size="small" items={items} defaultActiveKey={items.length <= 3 ? items.map((i) => i.key) : []} />}
      {ev.diff && (
        <div>
          <Typography.Text type="secondary">{t('evidence.diff')}</Typography.Text>
          <code style={codeStyle}>{ev.diff}</code>
        </div>
      )}
    </Space>
  )
}
