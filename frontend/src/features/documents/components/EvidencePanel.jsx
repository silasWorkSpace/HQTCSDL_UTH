import React from 'react';
import { Cpu, Code2, GitCommit, FileCode } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';

/**
 * Returns visual color and text label for confidence score (0.0 to 1.0).
 * Thresholds: >= 0.80 (High), 0.60 - 0.79 (Medium), < 0.60 (Low).
 */
function getConfidenceMeta(score = 0, t) {
  const percent = Math.round(score * 100);
  if (percent >= 80) {
    return {
      percent,
      label: t('documents.highConfidence'),
      color: '#16a34a',
      bg: '#dcfce7',
      border: '#86efac',
    };
  }
  if (percent >= 60) {
    return {
      percent,
      label: t('documents.medConfidence'),
      color: '#ca8a04',
      bg: '#fef9c3',
      border: '#fde047',
    };
  }
  return {
    percent,
    label: t('documents.lowConfidence'),
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fca5a5',
  };
}

export default function EvidencePanel({ generation, className = '' }) {
  const { t } = useI18n();

  if (!generation) {
    return (
      <div
        className={`ld-card ${className}`}
        style={{
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          padding: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
          <Code2 size={18} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>
            {t('documents.noAiNotice')}
          </span>
        </div>
      </div>
    );
  }

  const overall = getConfidenceMeta(generation.overallConfidence ?? 0, t);
  const sections = generation.sections || [];
  const evidenceList = generation.evidence || [];

  return (
    <div className={`ld-card ${className}`} style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={16} style={{ color: '#2563eb' }} />
          {t('documents.aiConfidence')}
        </h4>
        {generation.model && (
          <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
            {generation.model}
          </span>
        )}
      </div>

      {/* Overall Confidence Bar */}
      <div style={{ marginBottom: '16px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
            {t('documents.overallConfidence')}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: overall.bg,
              color: overall.color,
              border: `1px solid ${overall.border}`,
            }}
          >
            {overall.percent}% • {overall.label}
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${overall.percent}%`,
              height: '100%',
              backgroundColor: overall.color,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Section Confidence Breakdown */}
      {sections.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
            Độ tin cậy từng mục
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sections.map((sec, idx) => {
              const meta = getConfidenceMeta(sec.confidence ?? 0, t);
              return (
                <div key={idx} style={{ fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>{sec.title || sec.key}</span>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{meta.percent}%</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${meta.percent}%`, height: '100%', backgroundColor: meta.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evidence Sources List */}
      {evidenceList.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
            {t('documents.evidenceTitle')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {evidenceList.map((ev, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                <FileCode size={14} style={{ color: '#64748b', marginTop: '2px', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#0f172a', wordBreak: 'break-all' }}>
                    {ev.filePath}
                  </div>
                  {(ev.entityName || ev.commitHash) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '3px', color: '#64748b', fontSize: '11px' }}>
                      {ev.entityName && (
                        <span>
                          Thực thể: <code style={{ backgroundColor: '#e2e8f0', padding: '1px 4px', borderRadius: '3px' }}>{ev.entityName}</code>
                        </span>
                      )}
                      {ev.commitHash && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <GitCommit size={11} />
                          <code>{ev.commitHash.substring(0, 7)}</code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
