import { Button, Input, Modal, Space, Typography } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DISMISS_REASONS, MIN_OTHER_REASON_LENGTH, OTHER_REASON } from './constants'
import { buildDismissReason } from './model'

/**
 * Chọn lý do bỏ qua. Lý do có sẵn gửi ngay khi bấm (mở gợi ý 1, Bỏ qua 2, chọn lý do 3 — NFR-USAB-02);
 * chỉ lý do "Khác" cần nhập thêm rồi xác nhận.
 */
export default function DismissModal({ open, loading, onCancel, onConfirm }) {
  const { t } = useTranslation()
  const [otherMode, setOtherMode] = useState(false)
  const [note, setNote] = useState('')

  const labelOf = (code) => t(`suggestions.dismiss.reasons.${code}`)
  const otherReason = buildDismissReason({ code: OTHER_REASON, note }, labelOf)

  const pick = (code) => {
    if (code === OTHER_REASON) {
      setOtherMode(true)
      return
    }
    onConfirm(buildDismissReason({ code }, labelOf))
  }

  return (
    <Modal
      open={open}
      title={t('suggestions.dismiss.title')}
      footer={null}
      onCancel={onCancel}
      afterClose={() => {
        setOtherMode(false)
        setNote('')
      }}
    >
      {otherMode ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text strong>{t('suggestions.dismiss.otherLabel')}</Typography.Text>
          <Input.TextArea
            autoFocus
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('suggestions.dismiss.otherPlaceholder')}
            minLength={MIN_OTHER_REASON_LENGTH}
          />
          <Space>
            <Button onClick={() => setOtherMode(false)}>{t('suggestions.dismiss.back')}</Button>
            <Button type="primary" danger loading={loading} disabled={!otherReason} onClick={() => onConfirm(otherReason)}>
              {t('suggestions.dismiss.confirm')}
            </Button>
          </Space>
        </Space>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">{t('suggestions.dismiss.hint')}</Typography.Text>
          {DISMISS_REASONS.map((code) => (
            <Button key={code} block loading={loading} onClick={() => pick(code)}>
              {labelOf(code)}
            </Button>
          ))}
        </Space>
      )}
    </Modal>
  )
}
