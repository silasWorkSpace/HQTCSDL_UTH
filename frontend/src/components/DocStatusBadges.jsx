import React, { useState } from 'react';
import {
  FileText,
  Clock,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  XCircle,
  Archive,
  Ban,
  GitPullRequest,
  HelpCircle,
} from 'lucide-react';
import {
  getDocStatusMeta,
  getPublishStatusMeta,
  getPrStatusMeta,
} from '../constants/documentStatus';

/**
 * TONE_STYLES defines theme tokens for visual badges.
 * Ensures high contrast text with subtle, pleasing pastel backgrounds.
 * Text is always paired with semantic icons and full descriptive labels.
 */
const TONE_STYLES = {
  neutral: {
    bg: '#f1f5f9',
    text: '#475569',
    border: '#cbd5e1',
    dot: '#94a3b8',
  },
  warning: {
    bg: '#fef9c3',
    text: '#854d0e',
    border: '#fde047',
    dot: '#ca8a04',
  },
  info: {
    bg: '#e0f2fe',
    text: '#0369a1',
    border: '#7dd3fc',
    dot: '#0284c7',
  },
  indigo: {
    bg: '#e0e7ff',
    text: '#3730a3',
    border: '#a5b4fc',
    dot: '#4f46e5',
  },
  orange: {
    bg: '#ffedd5',
    text: '#9a3412',
    border: '#fdba74',
    dot: '#ea580c',
  },
  success: {
    bg: '#dcfce7',
    text: '#166534',
    border: '#86efac',
    dot: '#16a34a',
  },
  cyan: {
    bg: '#cffafe',
    text: '#155e75',
    border: '#67e8f9',
    dot: '#0891b2',
  },
  emerald: {
    bg: '#d1fae5',
    text: '#065f46',
    border: '#6ee7b7',
    dot: '#059669',
  },
  danger: {
    bg: '#fee2e2',
    text: '#991b1b',
    border: '#fca5a5',
    dot: '#dc2626',
  },
  slate: {
    bg: '#f8fafc',
    text: '#64748b',
    border: '#e2e8f0',
    dot: '#94a3b8',
  },
  muted: {
    bg: '#f3f4f6',
    text: '#6b7280',
    border: '#d1d5db',
    dot: '#9ca3af',
  },
};

/**
 * Maps status keys to semantic Lucide icons for instant recognition.
 */
function getStatusIcon(key, size = 13) {
  switch (key) {
    case 'DRAFT':
      return <FileText size={size} />;
    case 'PENDING_DEVELOPER_ACTION':
      return <Clock size={size} />;
    case 'IN_REVIEW_STAFF':
    case 'IN_REVIEW_MANAGER':
      return <UserCheck size={size} />;
    case 'CHANGES_REQUESTED':
      return <AlertTriangle size={size} />;
    case 'APPROVED':
    case 'PUBLISHED':
    case 'IN_TARGET_BRANCH':
    case 'MERGED':
      return <CheckCircle2 size={size} />;
    case 'PENDING_MERGE':
    case 'COMMITTED_TO_DOCS_BRANCH':
      return <GitMerge size={size} />;
    case 'REJECTED':
    case 'FAILED':
    case 'CLOSED_UNMERGED':
      return <XCircle size={size} />;
    case 'DISMISSED':
      return <Archive size={size} />;
    case 'SUPERSEDED':
      return <Ban size={size} />;
    case 'NONE':
      return <GitPullRequest size={size} />;
    default:
      return <HelpCircle size={size} />;
  }
}

/**
 * Single Status Chip with accessible tooltip.
 */
function StatusChip({ meta, size = 'md', isStrike = false }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tone = TONE_STYLES[meta.tone] || TONE_STYLES.neutral;

  const sizeClasses = {
    sm: { padding: '2px 7px', fontSize: '11px', iconSize: 11, gap: '4px' },
    md: { padding: '3px 9px', fontSize: '12px', iconSize: 13, gap: '5px' },
    lg: { padding: '5px 12px', fontSize: '13px', iconSize: 15, gap: '6px' },
  }[size] || { padding: '3px 9px', fontSize: '12px', iconSize: 13, gap: '5px' };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="status"
      aria-label={meta.label}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: sizeClasses.gap,
          padding: sizeClasses.padding,
          fontSize: sizeClasses.fontSize,
          fontWeight: 500,
          lineHeight: 1.4,
          borderRadius: '9999px',
          backgroundColor: tone.bg,
          color: tone.text,
          border: `1px solid ${tone.border}`,
          textDecoration: isStrike ? 'line-through' : 'none',
          whiteSpace: 'nowrap',
          cursor: 'default',
          transition: 'all 0.15s ease',
          userSelect: 'none',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', color: tone.text }}>
          {getStatusIcon(meta.key, sizeClasses.iconSize)}
        </span>
        <span>{meta.label}</span>
      </span>

      {showTooltip && meta.description && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 9px',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            fontSize: '11px',
            lineHeight: 1.35,
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          {meta.description}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              borderWidth: '4px',
              borderStyle: 'solid',
              borderColor: '#1e293b transparent transparent transparent',
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * DocStatusBadges Component (WF-24)
 * Displays three distinct, independent status indicators for documents:
 * 1. Document Lifecycle Status (docStatus)
 * 2. Storage/Publish Status (publishStatus)
 * 3. Git Pull Request Status (prStatus)
 *
 * @param {Object} props
 * @param {string} props.docStatus - Status from DOCUMENT_STATUS (e.g., 'DRAFT', 'APPROVED')
 * @param {string} [props.publishStatus] - Status from PUBLISH_STATUS (e.g., 'NOT_PUBLISHED')
 * @param {string} [props.prStatus] - Status from PR_STATUS (e.g., 'NONE', 'MERGED')
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Visual size of the badges
 * @param {boolean} [props.compact=false] - If true, displays only the primary docStatus chip
 * @param {'vi'|'en'} [props.lang='vi'] - Active interface language
 * @param {boolean} [props.showLabels=true] - Whether to show the category header labels
 * @param {string} [props.className] - Additional CSS class name
 * @returns {React.ReactElement}
 */
export default function DocStatusBadges({
  docStatus = 'DRAFT',
  publishStatus = 'NOT_PUBLISHED',
  prStatus = 'NONE',
  size = 'md',
  compact = false,
  lang = 'vi',
  showLabels = true,
  className = '',
}) {
  const docMeta = getDocStatusMeta(docStatus, lang);
  const publishMeta = getPublishStatusMeta(publishStatus, lang);
  const prMeta = getPrStatusMeta(prStatus, lang);

  if (compact) {
    return (
      <div className={`doc-status-badge-compact ${className}`} style={{ display: 'inline-flex' }}>
        <StatusChip meta={docMeta} size={size} isStrike={docStatus === 'SUPERSEDED'} />
      </div>
    );
  }

  const categoryLabels = {
    vi: { doc: 'Tài liệu', publish: 'Xuất bản', pr: 'PR' },
    en: { doc: 'Document', publish: 'Publish', pr: 'PR' },
  }[lang] || { doc: 'Tài liệu', publish: 'Xuất bản', pr: 'PR' };

  return (
    <div
      className={`doc-status-badges-group ${className}`}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: size === 'sm' ? '8px' : '12px',
      }}
    >
      {/* 1. Document Status */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        {showLabels && (
          <span
            style={{
              fontSize: size === 'sm' ? '11px' : '12px',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.025em',
            }}
          >
            {categoryLabels.doc}:
          </span>
        )}
        <StatusChip meta={docMeta} size={size} isStrike={docStatus === 'SUPERSEDED'} />
      </div>

      {/* Divider */}
      <span style={{ color: '#cbd5e1', userSelect: 'none' }}>•</span>

      {/* 2. Publish Status */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        {showLabels && (
          <span
            style={{
              fontSize: size === 'sm' ? '11px' : '12px',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.025em',
            }}
          >
            {categoryLabels.publish}:
          </span>
        )}
        <StatusChip meta={publishMeta} size={size} />
      </div>

      {/* Divider */}
      <span style={{ color: '#cbd5e1', userSelect: 'none' }}>•</span>

      {/* 3. PR Status */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        {showLabels && (
          <span
            style={{
              fontSize: size === 'sm' ? '11px' : '12px',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.025em',
            }}
          >
            {categoryLabels.pr}:
          </span>
        )}
        <StatusChip meta={prMeta} size={size} />
      </div>
    </div>
  );
}
