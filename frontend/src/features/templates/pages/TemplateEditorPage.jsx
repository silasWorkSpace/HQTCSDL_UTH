import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  History,
  Lock,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { templatesApi } from '../api';
import TemplateSectionBuilder from '../components/TemplateSectionBuilder';

const DOC_TYPES = ['API_REFERENCE', 'README', 'MODULE_GUIDE', 'ONBOARDING_GUIDE', 'ADR', 'OTHER'];
const TEMPLATE_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

export default function TemplateEditorPage({
  templateId,
  isCreate = false,
  readOnly = false,
  onNavigate,
  userRole = 'Technical Lead',
}) {
  const { t, formatDateTime } = useI18n();

  const [name, setName] = useState('');
  const [docType, setDocType] = useState('README');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [sections, setSections] = useState([]);
  const [formatRulesJson, setFormatRulesJson] = useState('{\n  "output": "markdown",\n  "language": "vi",\n  "max_heading_depth": 3\n}');
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);

  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      let parsedRules = null;
      if (formatRulesJson.trim()) {
        try { parsedRules = JSON.parse(formatRulesJson); } catch { /* ignore */ }
      }
      const res = await templatesApi.previewTemplate(templateId, {
        sections: { sections },
        formatRules: parsedRules,
      });
      setPreviewData(res);
      setPreviewModalOpen(true);
    } catch (err) {
      alert('Lỗi xem trước mẫu: ' + (err?.message || 'Thử lại sau'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRollback = async (verNo) => {
    if (!window.confirm(`Bạn có chắc muốn rollback template về phiên bản #${verNo}?`)) return;
    try {
      setRollingBack(true);
      await templatesApi.rollbackTemplate(templateId, verNo, `Rollback về v${verNo}`);
      alert(`Đã rollback thành công về phiên bản #${verNo}`);
      window.location.reload();
    } catch (err) {
      alert('Không thể rollback template: ' + (err?.message || 'Thử lại sau'));
    } finally {
      setRollingBack(false);
    }
  };

  const isTechLead = userRole === 'Technical Lead' || userRole === 'TechLead' || userRole === 'Administrator';
  const isFormDisabled = readOnly || !isTechLead;

  useEffect(() => {
    if (isCreate || !templateId) return;

    const loadTemplate = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tpl, verList] = await Promise.all([
          templatesApi.getTemplateById(templateId),
          templatesApi.getTemplateVersions(templateId),
        ]);

        setName(tpl.name || '');
        setDocType(tpl.docType || 'README');
        setDescription(tpl.description || '');
        setStatus(tpl.status || 'ACTIVE');

        // Parse sections JSON
        try {
          const parsed = typeof tpl.sections === 'string' ? JSON.parse(tpl.sections) : tpl.sections;
          setSections(Array.isArray(parsed?.sections) ? parsed.sections : []);
        } catch {
          setSections([]);
        }

        // Format rules JSON
        if (tpl.formatRules) {
          try {
            const formatted = typeof tpl.formatRules === 'string' ? JSON.parse(tpl.formatRules) : tpl.formatRules;
            setFormatRulesJson(JSON.stringify(formatted, null, 2));
          } catch {
            setFormatRulesJson(tpl.formatRules);
          }
        }

        setVersions(verList || []);
      } catch (err) {
        setError(err?.response?.data?.detail || err.message || 'Lỗi khi tải chi tiết template');
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [templateId, isCreate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isFormDisabled) return;

    // Validate name
    if (!name.trim()) {
      setError('Vui lòng nhập tên template.');
      return;
    }

    // Validate sections: at least 1 section, unique keys
    if (sections.length === 0) {
      setError('Template cần có ít nhất một mục nội dung (section).');
      return;
    }

    const keySet = new Set();
    for (const sec of sections) {
      const k = (sec.key || '').trim().toLowerCase();
      if (!k) {
        setError('Tất cả các mục phải có khóa (Key) không để trống.');
        return;
      }
      if (keySet.has(k)) {
        setError(`Phát hiện khóa mục bị trùng lặp: "${sec.key}". Mỗi mục phải có khóa duy nhất.`);
        return;
      }
      keySet.add(k);
    }

    // Validate formatRules JSON
    let parsedRules = null;
    if (formatRulesJson.trim()) {
      try {
        parsedRules = JSON.parse(formatRulesJson);
      } catch (jsonErr) {
        setError('Cú pháp Quy tắc định dạng nâng cao (JSON) không hợp lệ: ' + jsonErr.message);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const payload = {
        name: name.trim(),
        docType,
        description: description.trim(),
        status,
        sections: { sections },
        formatRules: parsedRules,
      };

      if (isCreate) {
        await templatesApi.createTemplate(payload);
        if (onNavigate) onNavigate('template-list');
      } else {
        await templatesApi.updateTemplate(templateId, payload);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      // Display verbatim 400 detail if backend error returned
      const backendDetail = err?.response?.data?.detail || err?.response?.data?.message || err.message;
      setError(backendDetail);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
        <div className="ld-skeleton" style={{ width: '180px', height: '32px', marginBottom: '16px' }} />
        <div className="ld-skeleton" style={{ height: '400px' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('template-list')}
          className="ld-btn ld-btn-ghost"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
          {isCreate ? t('templates.createTitle') : `${t('templates.editTitle')}: ${name}`}
        </h2>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="ld-btn ld-btn-ghost"
            style={{ padding: '8px 14px', border: '1px solid #cbd5e1' }}
          >
            <Eye size={14} />
            {previewLoading ? 'Đang dựng...' : 'Xem trước'}
          </button>

          {!isFormDisabled && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="ld-btn ld-btn-primary"
              style={{ padding: '8px 18px' }}
            >
              <Save size={14} />
              {saving ? t('common.saving') : t('common.save')}
            </button>
          )}
        </div>
      </div>

      {isFormDisabled && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            color: '#475569',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <Lock size={15} />
          Chế độ chỉ xem. Chỉ vai trò Technical Lead mới có quyền chỉnh sửa template.
        </div>
      )}

      {saveSuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '6px',
            color: '#166534',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <CheckCircle2 size={16} />
          Đã lưu thành công cấu trúc template mới!
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Main Form Card */}
      <form onSubmit={handleSubmit} className="ld-card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label className="ld-label" htmlFor="tplName">
              {t('templates.fieldName')} *
            </label>
            <input
              id="tplName"
              type="text"
              className="ld-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isFormDisabled}
              placeholder="VD: Microservice API Reference"
              required
            />
          </div>

          <div>
            <label className="ld-label" htmlFor="tplDocType">
              {t('templates.fieldDocType')} *
            </label>
            <select
              id="tplDocType"
              className="ld-select"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={isFormDisabled}
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ld-label" htmlFor="tplStatus">
              {t('templates.fieldStatus')} *
            </label>
            <select
              id="tplStatus"
              className="ld-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={isFormDisabled}
              required
            >
              {TEMPLATE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="ld-label" htmlFor="tplDesc">
            {t('templates.fieldDesc')}
          </label>
          <textarea
            id="tplDesc"
            rows={2}
            className="ld-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isFormDisabled}
            placeholder="Mô tả mục đích và cách áp dụng của template..."
          />
        </div>

        {/* Section Outline Builder */}
        <TemplateSectionBuilder
          sections={sections}
          onChange={setSections}
        />

        {/* Advanced JSON Rules Accordion */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setShowAdvancedRules((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '13px',
              fontWeight: 600,
              color: '#2563eb',
              cursor: 'pointer',
              marginBottom: '10px',
            }}
          >
            {showAdvancedRules ? '▼ Ẩn quy tắc định dạng nâng cao' : '▶ ' + t('templates.advancedRules')}
          </button>

          {showAdvancedRules && (
            <div>
              <textarea
                rows={5}
                className="ld-textarea"
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                value={formatRulesJson}
                onChange={(e) => setFormatRulesJson(e.target.value)}
                disabled={isFormDisabled}
                placeholder="JSON cấu hình formatRules..."
              />
            </div>
          )}
        </div>
      </form>

      {/* Template Versions History (if editing) */}
      {!isCreate && versions.length > 0 && (
        <div className="ld-card" style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={16} style={{ color: '#2563eb' }} />
            Lịch sử phiên bản Template ({versions.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {versions.map((v) => (
              <div
                key={v.id || v.versionNo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>Phiên bản #{v.versionNo}</span>
                  {v.changeNote && (
                    <span style={{ marginLeft: '10px', color: '#64748b', fontStyle: 'italic' }}>
                      — {v.changeNote}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {formatDateTime(v.createdAt)}
                  </span>
                  {!isFormDisabled && (
                    <button
                      type="button"
                      disabled={rollingBack}
                      onClick={() => handleRollback(v.versionNo)}
                      className="ld-btn ld-btn-ghost ld-btn-sm"
                      style={{ color: '#dc2626', border: '1px solid #fca5a5', padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title={`Rollback về phiên bản #${v.versionNo}`}
                    >
                      <RotateCcw size={12} />
                      Rollback
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                Xem trước cấu trúc Template ({previewData?.totalSections || 0} mục)
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="ld-btn ld-btn-ghost ld-btn-sm"
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ marginBottom: '12px', fontSize: '12px', color: '#64748b' }}>
                Mẫu markdown kết xuất sơ bộ dựa trên các section và format rules hiện tại:
              </div>
              <pre
                style={{
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  padding: '16px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                }}
              >
                {previewData?.previewMarkdown || '(Chưa có nội dung markdown)'}
              </pre>
            </div>
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="ld-btn ld-btn-secondary"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
