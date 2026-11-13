import { Alert, Button, Card, Input, Radio, Space, Tooltip, Typography, message } from 'antd'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { problemMessage } from '../shared/problemMessage'
import { useDecideReview } from './hooks'
import { buildDecisionPayload, decisionBlock, decisionOptions, reasonRequired, validateDecision } from './model'

/**
 * Quyết định duyệt. Staff: duyệt chuyển lên Manager hoặc từ chối. Manager: phê duyệt, từ chối, trả lại.
 * Từ chối và trả lại bắt buộc có lý do. Người nộp bản này bị vô hiệu hóa kèm chú thích (WF-22);
 * server vẫn là nơi chặn cuối cùng.
 */
export default function DecisionPanel({ task, user }) {
  const { t } = useTranslation()
  const decide = useDecideReview(task.id)
  const [decision, setDecision] = useState(null)
  const [reason, setReason] = useState('')
  const [comments, setComments] = useState([])
  const [draft, setDraft] = useState({ content: '', lineNumber: '' })
  const [showErrors, setShowErrors] = useState(false)

  const block = decisionBlock({ task, user })
  const disabled = block !== null
  const blockText = block ? t(`reviews.decision.block.${block}`) : null
  const validation = validateDecision({ decision, reason, level: task.level })
  const isManager = String(task.level).toLowerCase() === 'manager'

  const optionLabel = (value) => {
    if (value === 'APPROVE') return t(isManager ? 'reviews.decision.approveManager' : 'reviews.decision.approveStaff')
    return t(`reviews.decision.options.${value}`)
  }

  const addComment = () => {
    if (!draft.content.trim()) return
    setComments((list) => [...list, draft])
    setDraft({ content: '', lineNumber: '' })
  }

  const submit = () => {
    if (!validation.valid) {
      setShowErrors(true)
      return
    }
    decide.mutate(buildDecisionPayload({ decision, reason, comments }), {
      onSuccess: () => {
        message.success(t(`reviews.decision.success.${decision}`))
        setDecision(null)
        setReason('')
        setComments([])
        setShowErrors(false)
      },
      onError: (error) => message.error(problemMessage(error, t)),
    })
  }

  return (
    <Card title={t('reviews.decision.title')} size="small">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {blockText && <Alert type={block === 'self' ? 'warning' : 'info'} showIcon message={blockText} />}

        <Radio.Group
          disabled={disabled}
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {decisionOptions(task.level).map((value) => (
            <Radio key={value} value={value}>{optionLabel(value)}</Radio>
          ))}
        </Radio.Group>

        <div>
          <Typography.Text strong>
            {reasonRequired(decision) ? t('reviews.decision.reasonRequired') : t('reviews.decision.reason')}
          </Typography.Text>
          <Input.TextArea
            rows={3}
            disabled={disabled}
            value={reason}
            status={showErrors && validation.error === 'reasonRequired' ? 'error' : undefined}
            placeholder={t('reviews.decision.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div>
          <Typography.Text strong>{t('reviews.decision.commentsTitle')}</Typography.Text>
          {comments.map((c, index) => (
            <div key={`${c.content}-${index}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                {c.lineNumber ? `[${t('reviews.page.line', { line: c.lineNumber })}] ` : ''}
                {c.content}
              </span>
              <Button
                type="text"
                size="small"
                aria-label={t('reviews.decision.removeComment')}
                icon={<Trash2 size={14} aria-hidden="true" />}
                onClick={() => setComments((list) => list.filter((_, i) => i !== index))}
              />
            </div>
          ))}
          <Space.Compact style={{ width: '100%', marginTop: 4 }}>
            <Input
              type="number"
              min={1}
              disabled={disabled}
              style={{ width: 80 }}
              placeholder={t('reviews.decision.linePlaceholder')}
              value={draft.lineNumber}
              onChange={(e) => setDraft((d) => ({ ...d, lineNumber: e.target.value }))}
            />
            <Input
              disabled={disabled}
              placeholder={t('reviews.decision.commentPlaceholder')}
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              onPressEnter={addComment}
            />
            <Button disabled={disabled || !draft.content.trim()} onClick={addComment}>{t('reviews.decision.addComment')}</Button>
          </Space.Compact>
        </div>

        {showErrors && validation.error && (
          <Alert type="error" showIcon message={t(`reviews.decision.errors.${validation.error}`)} />
        )}

        <Tooltip title={blockText}>
          <span style={{ display: 'inline-block' }}>
            <Button type="primary" disabled={disabled} loading={decide.isPending} onClick={submit}>
              {t('reviews.decision.submit')}
            </Button>
          </span>
        </Tooltip>
      </Space>
    </Card>
  )
}
