import React from 'react';
import { Link2, Code, GitCommit, GitPullRequest, Bookmark } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';

function getLinkTypeIcon(type) {
  switch (type) {
    case 'CODE_ENTITY':
      return <Code size={14} style={{ color: '#2563eb' }} />;
    case 'COMMIT':
      return <GitCommit size={14} style={{ color: '#059669' }} />;
    case 'PR':
      return <GitPullRequest size={14} style={{ color: '#d97706' }} />;
    default:
      return <Bookmark size={14} style={{ color: '#64748b' }} />;
  }
}

export default function DocCodeLinksPanel({ links = [], className = '' }) {
  const { t } = useI18n();

  if (!links || links.length === 0) {
    return null;
  }

  // Group by linkType
  const grouped = links.reduce((acc, link) => {
    const key = link.linkType || 'OTHER';
    if (!acc[key]) acc[key] = [];
    acc[key].push(link);
    return acc;
  }, {});

  return (
    <div className={`ld-card ${className}`} style={{ padding: '18px' }}>
      <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Link2 size={16} style={{ color: '#2563eb' }} />
        {t('documents.linksTitle')}
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
              {type} ({items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {items.map((link) => (
                <div
                  key={link.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ marginTop: '2px' }}>{getLinkTypeIcon(type)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {link.codeEntity ? (
                      <>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>
                            [{link.codeEntity.kind}]
                          </span>
                          {link.codeEntity.name}
                        </div>
                        {link.codeEntity.filePath && (
                          <div style={{ color: '#64748b', fontSize: '11px', wordBreak: 'break-all' }}>
                            {link.codeEntity.filePath}
                          </div>
                        )}
                        {link.codeEntity.signature && (
                          <code
                            style={{
                              display: 'block',
                              marginTop: '2px',
                              padding: '2px 4px',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '3px',
                              fontSize: '11px',
                              color: '#334155',
                              wordBreak: 'break-all',
                            }}
                          >
                            {link.codeEntity.signature}
                          </code>
                        )}
                      </>
                    ) : (
                      <div style={{ fontWeight: 500, color: '#334155', wordBreak: 'break-all' }}>
                        {link.externalRef || link.codeEntityId || 'Liên kết ngoài'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
