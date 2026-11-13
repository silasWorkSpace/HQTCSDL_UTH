import { AlertOctagon, AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SEVERITY_STYLE } from '../constants/severity'

const ICONS = { Low: Info, Medium: AlertTriangle, High: ShieldAlert, Critical: AlertOctagon }

/**
 * Mức drift (Low, Medium, High, Critical). Luôn có nhãn chữ và biểu tượng kèm màu,
 * người dùng không phân biệt được màu vẫn đọc được mức (NFR-USAB-03).
 */
export default function SeverityBadge({ severity, compact = false }) {
  const { t } = useTranslation()
  const style = SEVERITY_STYLE[severity]
  if (!style) return <span>{t('severity.none')}</span>

  const Icon = ICONS[severity]
  const label = t(`severity.${severity.toLowerCase()}`)
  return (
    <span
      title={t('severity.tooltip', { level: label })}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '0 6px' : '2px 8px',
        border: `1px solid ${style.border}`,
        borderRadius: 4,
        background: style.background,
        color: style.color,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: '20px',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  )
}
