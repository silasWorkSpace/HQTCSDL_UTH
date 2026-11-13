import { Alert, Button, Descriptions, Drawer, Input, Progress, Skeleton, Space, Tag, Typography, message } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import DiffViewer from '../../components/DiffViewer'
import EvidencePanel from '../../components/EvidencePanel'
import MarkdownView from '../../components/MarkdownView'
import SeverityBadge from '../../components/SeverityBadge'
import { formatDateTime, slug } from '../shared/format'
import { problemMessage } from '../shared/problemMessage'
import DismissModal from './DismissModal'
import {
  useAcceptSuggestion,
  useDismissSuggestion,
  useDriftAlerts,
  useEditSuggestion,
  usePublishedContent,
} from './hooks'
import { confidencePercent, isPending } from './model'

function SuggestionDetail({ suggestion, onDone }) {
  const { t, i18n } = useTranslation()
  const alerts = useDriftAlerts(suggestion.documentId)
  const published = usePublishedContent(suggestion.documentId)
  const accept = useAcceptSuggestion()
  const edit = useEditSuggestion()
  const dismiss = useDismissSuggestion()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(suggestion.content)
  const [dismissOpen, setDismissOpen] = useState(false)

  const pending = isPending(suggestion)
  const busy = accept.isPending || edit.isPending || dismiss.isPending
  const linkedAlert = (alerts.data ?? []).find((a) => a.id === suggestion.driftAlertId) ?? null
  const severity = linkedAlert?.severity ?? suggestion.topSeverity
  const percent = confidencePercent(suggestion.confidence)
  const shownContent = editing ? draft : suggestion.content

  const run = (mutation, variables, okKey) =>
    mutation.mutate(variables, {
      onSuccess: () => {
        message.success(t(okKey))
        setDismissOpen(false)
        onDone()
      },
      onError: (error) => message.error(problemMessage(error, t)),
    })

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {pending ? (
        <Space wrap>
          <Button type="primary" loading={accept.isPending} disabled={busy || editing} onClick={() => run(accept, suggestion.id, 'suggestions.drawer.acceptedOk')}>
            {t('suggestions.drawer.accept')}
          </Button>
          {editing ? (
            <>
              <Button type="primary" loading={edit.isPending} disabled={busy || !draft.trim()} onClick={() => run(edit, { id: suggestion.id, content: draft }, 'suggestions.drawer.editedOk')}>
                {t('suggestions.drawer.sendEdit')}
              </Button>
              <Button disabled={busy} onClick={() => { setEditing(false); setDraft(suggestion.content) }}>
                {t('suggestions.drawer.cancelEdit')}
              </Button>
            </>
          ) : (
            <Button disabled={busy} onClick={() => setEditing(true)}>{t('suggestions.drawer.edit')}</Button>
          )}
          <Button danger disabled={busy || editing} onClick={() => setDismissOpen(true)}>{t('suggestions.drawer.dismiss')}</Button>
        </Space>
      ) : (
        <Alert
          type="info"
          showIcon
          message={t('suggestions.drawer.handled')}
          description={suggestion.dismissReason ? t('suggestions.drawer.dismissedWith', { reason: suggestion.dismissReason }) : null}
        />
      )}

      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('suggestions.drawer.driftType')}>
          {linkedAlert?.driftType ? (
            <Tag>{t(`suggestions.history.types.${slug(linkedAlert.driftType)}`, { defaultValue: linkedAlert.driftType })}</Tag>
          ) : (
            alerts.isLoading ? <Skeleton.Input active size="small" /> : '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('suggestions.drawer.severity')}>
          <SeverityBadge severity={severity} />
        </Descriptions.Item>
        <Descriptions.Item label={t('suggestions.drawer.confidence')}>
          {percent == null ? '—' : <Progress percent={percent} size="small" style={{ maxWidth: 220 }} />}
        </Descriptions.Item>
        <Descriptions.Item label={t('suggestions.columns.createdAt')}>
          {formatDateTime(suggestion.createdAt, i18n.language)}
        </Descriptions.Item>
        {suggestion.evidence.commit && (
          <Descriptions.Item label={t('evidence.commit')}>{String(suggestion.evidence.commit).slice(0, 10)}</Descriptions.Item>
        )}
      </Descriptions>

      <section>
        <Typography.Title level={5}>{editing ? t('suggestions.drawer.editing') : t('suggestions.drawer.suggested')}</Typography.Title>
        {editing ? (
          <Input.TextArea rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} />
        ) : (
          <MarkdownView content={suggestion.content} />
        )}
      </section>

      <section>
        <Typography.Title level={5}>{t('suggestions.drawer.diffTitle')}</Typography.Title>
        {published.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : published.data ? (
          <DiffViewer oldText={published.data} newText={shownContent} />
        ) : (
          <Alert type="info" showIcon message={t('suggestions.drawer.noPublished')} />
        )}
      </section>

      <section>
        <Typography.Title level={5}>{t('suggestions.drawer.evidence')}</Typography.Title>
        <EvidencePanel evidence={suggestion.evidence} />
      </section>

      <Link to={`/drift-history?documentId=${suggestion.documentId}`}>{t('suggestions.drawer.history')}</Link>

      <DismissModal
        open={dismissOpen}
        loading={dismiss.isPending}
        onCancel={() => setDismissOpen(false)}
        onConfirm={(reason) => run(dismiss, { id: suggestion.id, reason }, 'suggestions.drawer.dismissedOk')}
      />
    </Space>
  )
}

/** Drawer chi tiết gợi ý. Mở gợi ý là thao tác 1, Accept là thao tác 2 (NFR-USAB-02). */
export default function SuggestionDrawer({ suggestion, onClose }) {
  const { t } = useTranslation()
  return (
    <Drawer open={Boolean(suggestion)} onClose={onClose} width={720} title={suggestion?.documentTitle || t('suggestions.drawer.title')}>
      {suggestion && <SuggestionDetail key={suggestion.id} suggestion={suggestion} onDone={onClose} />}
    </Drawer>
  )
}
