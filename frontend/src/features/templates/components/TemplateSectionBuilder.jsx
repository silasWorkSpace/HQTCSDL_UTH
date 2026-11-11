import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';

const ENTITY_KINDS = ['class', 'method', 'endpoint', 'parameter'];

export default function TemplateSectionBuilder({
  sections = [],
  onChange,
  backendError = null,
}) {
  const { t } = useI18n();

  const handleAddSection = () => {
    const newKey = `section_${sections.length + 1}`;
    const next = [
      ...sections,
      {
        key: newKey,
        title: 'Mục mới',
        required: true,
        placeholder: '',
        entity_kind: '',
      },
    ];
    onChange(next);
  };

  const handleRemoveSection = (index) => {
    const next = sections.filter((_, idx) => idx !== index);
    onChange(next);
  };

  const handleMove = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const next = [...sections];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    onChange(next);
  };

  const handleUpdate = (index, field, value) => {
    const next = [...sections];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  // Check duplicate keys
  const keyCounts = sections.reduce((acc, sec) => {
    const k = (sec.key || '').trim().toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
          {t('templates.sectionsTitle')} ({sections.length})
        </h4>

        <button
          type="button"
          onClick={handleAddSection}
          className="ld-btn ld-btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          <Plus size={14} />
          {t('templates.btnAddSection')}
        </button>
      </div>

      {backendError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '13px',
            marginBottom: '14px',
          }}
        >
          <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>{backendError}</div>
        </div>
      )}

      {sections.length === 0 ? (
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '8px',
            color: '#64748b',
            fontSize: '13px',
          }}
        >
          Chưa có mục nào được định nghĩa. Bấm "Thêm mục mới" để thiết lập cấu trúc.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sections.map((sec, idx) => {
            const isDuplicate = keyCounts[(sec.key || '').trim().toLowerCase()] > 1;

            return (
              <div
                key={idx}
                style={{
                  padding: '14px',
                  backgroundColor: '#ffffff',
                  border: `1px solid ${isDuplicate ? '#f87171' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#f1f5f9',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#475569',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{sec.title || 'Mục chưa đặt tên'}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, -1)}
                      disabled={idx === 0}
                      className="ld-btn ld-btn-ghost"
                      style={{ padding: '4px 6px' }}
                      title="Di chuyển lên"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 1)}
                      disabled={idx === sections.length - 1}
                      className="ld-btn ld-btn-ghost"
                      style={{ padding: '4px 6px' }}
                      title="Di chuyển xuống"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(idx)}
                      className="ld-btn ld-btn-ghost"
                      style={{ padding: '4px 6px', color: '#dc2626' }}
                      title="Xóa mục"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div>
                    <label className="ld-label" style={{ fontSize: '11px' }}>
                      {t('templates.sectionKey')} *
                    </label>
                    <input
                      type="text"
                      className="ld-input"
                      value={sec.key || ''}
                      onChange={(e) => handleUpdate(idx, 'key', e.target.value)}
                      placeholder="VD: overview"
                      required
                    />
                    {isDuplicate && (
                      <span style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px', display: 'block' }}>
                        Khóa mục bị trùng lặp!
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="ld-label" style={{ fontSize: '11px' }}>
                      {t('templates.sectionTitle')} *
                    </label>
                    <input
                      type="text"
                      className="ld-input"
                      value={sec.title || ''}
                      onChange={(e) => handleUpdate(idx, 'title', e.target.value)}
                      placeholder="VD: Tổng quan kiến trúc"
                      required
                    />
                  </div>

                  <div>
                    <label className="ld-label" style={{ fontSize: '11px' }}>
                      {t('templates.sectionPlaceholder')}
                    </label>
                    <input
                      type="text"
                      className="ld-input"
                      value={sec.placeholder || ''}
                      onChange={(e) => handleUpdate(idx, 'placeholder', e.target.value)}
                      placeholder="VD: {{endpoint_list}}"
                    />
                  </div>

                  <div>
                    <label className="ld-label" style={{ fontSize: '11px' }}>
                      {t('templates.sectionEntityKind')}
                    </label>
                    <select
                      className="ld-select"
                      value={sec.entity_kind || ''}
                      onChange={(e) => handleUpdate(idx, 'entity_kind', e.target.value || undefined)}
                    >
                      <option value="">(Không chọn)</option>
                      {ENTITY_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(sec.required)}
                      onChange={(e) => handleUpdate(idx, 'required', e.target.checked)}
                    />
                    {t('templates.sectionRequired')}
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
