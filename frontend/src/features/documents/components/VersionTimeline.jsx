import React from 'react';
import {
  History,
  GitCommit,
  GitPullRequest,
  RotateCcw,
  Eye,
  Columns,
  ShieldAlert,
  Bot,
  User,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';

function getActorRoleStyle(role) {
  switch (role) {
    case 'AI':
      return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: Bot };
    case 'Technical Lead':
    case 'TechLead':
      return { bg: '#fdf4ff', text: '#86198f', border: '#f5d0fe', icon: User };
    case 'Manager':
      return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe', icon: User };
    case 'Staff':
      return { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', icon: User };
    default:
      return { bg: '#f8fafc', text: '#334155', border: '#e2e8f0', icon: User };
  }
}

function getChangeSourceLabel(source) {
  switch (source) {
    case 'AI_GENERATION':
      return 'Sinh tự động từ AI';
    case 'AUTO_UPDATE':
      return 'Cập nhật tự động (Sync)';
    case 'DRIFT_SUGGESTION':
      return 'Gợi ý từ thay đổi mã nguồn';
    case 'MANUAL_EDIT':
      return 'Chỉnh sửa thủ công';
    case 'ROLLBACK':
      return 'Khôi phục phiên bản cũ';
    case 'REVIEW_ACTION':
      return 'Hành động kiểm duyệt';
    default:
      return source || 'Thay đổi';
  }
}

export default function VersionTimeline({
  versions = [],
  selectedVersionNo,
  onSelectVersion,
  onCompareDiff,
  onOpenRollback,
  canRollback = false,
  className = '',
}) {
  const { t, formatDateTime } = useI18n();

  if (!versions || versions.length === 0) {
    return (
      <div className={`ld-card ${className}`} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
        {t('common.empty')}
      </div>
    );
  }

  return (
    <div className={`ld-card ${className}`} style={{ padding: '20px' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <History size={17} style={{ color: '#2563eb' }} />
        {t('documents.history')} ({versions.length})
      </h4>

      <div style={{ position: 'relative', paddingLeft: '20px' }}>
        {/* Continuous vertical line */}
        <div
          style={{
            position: 'absolute',
            left: '7px',
            top: '8px',
            bottom: '8px',
            width: '2px',
            backgroundColor: '#e2e8f0',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {versions.map((ver) => {
            const isSelected = selectedVersionNo === ver.versionNo;
            const roleStyle = getActorRoleStyle(ver.actorRole);
            const RoleIcon = roleStyle.icon;

            return (
              <div key={ver.id || ver.versionNo} style={{ position: 'relative' }}>
                {/* Node dot on line */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-18px',
                    top: '6px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                    border: `2px solid ${isSelected ? '#2563eb' : '#94a3b8'}`,
                    transition: 'all 0.15s ease',
                  }}
                />

                {/* Timeline Card */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    border: `1px solid ${isSelected ? '#93c5fd' : '#e2e8f0'}`,
                    boxShadow: isSelected ? '0 0 0 1px #3b82f6' : '0 1px 2px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                        Phiên bản #{ver.versionNo}
                      </span>
                      {ver.statusAtVersion && (
                        <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                          {ver.statusAtVersion}
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {formatDateTime(ver.createdAt)}
                    </span>
                  </div>

                  {/* Actor & Change Source */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: roleStyle.bg,
                        color: roleStyle.text,
                        border: `1px solid ${roleStyle.border}`,
                        fontWeight: 500,
                        fontSize: '11px',
                      }}
                    >
                      <RoleIcon size={11} />
                      {ver.actorRole || 'Unknown'}
                    </span>

                    <span style={{ color: '#475569', fontWeight: 500 }}>
                      {getChangeSourceLabel(ver.changeSource)}
                    </span>
                  </div>

                  {/* Redacted warning badge */}
                  {ver.contentRedacted && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        marginBottom: '8px',
                      }}
                    >
                      <ShieldAlert size={12} />
                      {t('documents.redactedNotice')}
                    </div>
                  )}

                  {/* Reason & Commit details */}
                  {ver.reason && (
                    <div style={{ fontSize: '12px', color: '#475569', marginBottom: '8px', fontStyle: 'italic' }}>
                      "{ver.reason}"
                    </div>
                  )}

                  {(ver.sourceCommitSha || ver.sourcePrNumber) && (
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                      {ver.sourceCommitSha && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <GitCommit size={12} />
                          <code>{ver.sourceCommitSha.substring(0, 7)}</code>
                        </span>
                      )}
                      {ver.sourcePrNumber && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <GitPullRequest size={12} />
                          PR #{ver.sourcePrNumber}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onSelectVersion(ver.versionNo)}
                      className={`ld-btn ${isSelected ? 'ld-btn-primary' : 'ld-btn-secondary'}`}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      <Eye size={12} />
                      Xem nội dung
                    </button>

                    {onCompareDiff && (
                      <button
                        type="button"
                        onClick={() => onCompareDiff(ver.versionNo)}
                        className="ld-btn ld-btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <Columns size={12} />
                        So sánh
                      </button>
                    )}

                    {canRollback && !ver.contentRedacted && onOpenRollback && (
                      <button
                        type="button"
                        onClick={() => onOpenRollback(ver)}
                        className="ld-btn ld-btn-ghost"
                        style={{ padding: '3px 8px', fontSize: '11px', color: '#b91c1c' }}
                        title="Rollback tạo bản mới từ bản này"
                      >
                        <RotateCcw size={12} />
                        Rollback
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
