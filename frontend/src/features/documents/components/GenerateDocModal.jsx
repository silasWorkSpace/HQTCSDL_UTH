import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle2, Clock, FileCode, FolderTree, BookOpen } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { documentsApi } from '../api';
import { templatesApi } from '../../templates/api';

export default function GenerateDocModal({ isOpen, onClose, onGenerated }) {
  const { t } = useI18n();

  const [repos, setRepos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [collections, setCollections] = useState([]);

  // Form fields
  const [repositoryId, setRepositoryId] = useState('');
  const [scopeType, setScopeType] = useState('MODULE');
  const [scopeReference, setScopeReference] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [title, setTitle] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [commitSha, setCommitSha] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobResult, setJobResult] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset state
    setError(null);
    setJobResult(null);

    // Load repos, templates, collections
    const loadPrerequisites = async () => {
      try {
        const [repoList, tplList, colList] = await Promise.all([
          documentsApi.getRepositories(),
          templatesApi.getTemplates({ status: 'ACTIVE' }),
          templatesApi.getCollections(),
        ]);
        setRepos(repoList);
        if (repoList.length > 0) setRepositoryId((prev) => prev || repoList[0].id);

        setTemplates(tplList);
        if (tplList.length > 0) setTemplateId((prev) => prev || tplList[0].id);

        setCollections(colList);
      } catch (err) {
        setError('Không thể tải danh sách tiền đề: ' + err.message);
      }
    };

    loadPrerequisites();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề tài liệu');
      return;
    }

    if (!targetPath.trim()) {
      setError('Vui lòng nhập đường dẫn lưu trữ trong repo');
      return;
    }

    // Validate relative path
    const cleanPath = targetPath.trim();
    if (cleanPath.startsWith('/') || cleanPath.includes('..')) {
      setError('Đường dẫn lưu phải là đường dẫn tương đối (không bắt đầu bằng / và không chứa ..)');
      return;
    }

    if ((scopeType === 'FILE' || scopeType === 'MODULE') && !scopeReference.trim()) {
      setError('Vui lòng nhập đường dẫn mã nguồn tham chiếu cho phạm vi đã chọn');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        scopeType,
        scopeReference: scopeReference.trim(),
        repositoryId,
        templateId,
        collectionId: collectionId || null,
        title: title.trim(),
        targetPath: cleanPath,
        commitSha: commitSha.trim() || undefined,
      };

      const res = await documentsApi.generateDocument(payload);
      setJobResult(res);
      if (onGenerated) onGenerated(res);
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Lỗi khi gửi yêu cầu sinh tài liệu'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setJobResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="ld-modal-overlay">
      <div className="ld-modal" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: '#2563eb' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              {t('documents.genModalTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="ld-btn ld-btn-ghost"
            style={{ padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px' }}>
          {jobResult ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                {t('documents.genSuccess')}
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#475569' }}>
                {t('documents.genJobNotice')}
              </p>
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#1e293b',
                  marginBottom: '24px',
                  wordBreak: 'break-all',
                }}
              >
                {jobResult.jobId || jobResult.correlationId || 'N/A'}
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="ld-btn ld-btn-primary"
                style={{ width: '100%', padding: '10px' }}
              >
                {t('common.close')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                {t('documents.genModalDesc')}
              </div>

              {/* Repo Selector */}
              <div style={{ marginBottom: '14px' }}>
                <label className="ld-label" htmlFor="genRepo">
                  {t('documents.genSelectRepo')}
                </label>
                <select
                  id="genRepo"
                  className="ld-select"
                  value={repositoryId}
                  onChange={(e) => setRepositoryId(e.target.value)}
                  required
                >
                  {repos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.defaultBranch || 'main'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope Selection */}
              <div style={{ marginBottom: '14px' }}>
                <label className="ld-label">{t('documents.genScopeType')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'FILE', label: t('documents.genScopeFile'), icon: FileCode },
                    { id: 'MODULE', label: t('documents.genScopeModule'), icon: FolderTree },
                    { id: 'REPOSITORY', label: t('documents.genScopeRepo'), icon: BookOpen },
                  ].map((sc) => {
                    const Icon = sc.icon;
                    const isSelected = scopeType === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setScopeType(sc.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px',
                          borderRadius: '6px',
                          border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          color: isSelected ? '#1d4ed8' : '#475569',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        <Icon size={18} />
                        {sc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scope Reference Path */}
              {scopeType !== 'REPOSITORY' && (
                <div style={{ marginBottom: '14px' }}>
                  <label className="ld-label" htmlFor="scopeRef">
                    {t('documents.genScopeRef')}
                  </label>
                  <input
                    id="scopeRef"
                    type="text"
                    className="ld-input"
                    value={scopeReference}
                    onChange={(e) => setScopeReference(e.target.value)}
                    placeholder={t('documents.genScopeRefPlaceholder')}
                    required
                  />
                </div>
              )}

              {/* Template Selector */}
              <div style={{ marginBottom: '14px' }}>
                <label className="ld-label" htmlFor="genTpl">
                  {t('documents.genSelectTemplate')}
                </label>
                <select
                  id="genTpl"
                  className="ld-select"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  required
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} — {tpl.docType}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title & Target Path */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="ld-label" htmlFor="docTitle">
                    {t('documents.genDocTitle')}
                  </label>
                  <input
                    id="docTitle"
                    type="text"
                    className="ld-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Authentication Module Guide"
                    required
                  />
                </div>
                <div>
                  <label className="ld-label" htmlFor="targetPath">
                    {t('documents.genTargetPath')}
                  </label>
                  <input
                    id="targetPath"
                    type="text"
                    className="ld-input"
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                    placeholder={t('documents.genTargetPathPlaceholder')}
                    required
                  />
                </div>
              </div>

              {/* Optional Collection and Commit SHA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label className="ld-label" htmlFor="genCol">
                    {t('documents.genSelectCollection')}
                  </label>
                  <select
                    id="genCol"
                    className="ld-select"
                    value={collectionId}
                    onChange={(e) => setCollectionId(e.target.value)}
                  >
                    <option value="">(Không chọn)</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ld-label" htmlFor="commitSha">
                    {t('documents.genCommitSha')}
                  </label>
                  <input
                    id="commitSha"
                    type="text"
                    className="ld-input"
                    value={commitSha}
                    onChange={(e) => setCommitSha(e.target.value)}
                    placeholder="VD: 7f8a9b1c"
                  />
                </div>
              </div>

              {error && (
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    borderRadius: '6px',
                    fontSize: '12px',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  className="ld-btn ld-btn-secondary"
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="ld-btn ld-btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Clock size={14} className="ld-spin" />
                      {t('documents.genSubmitting')}
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      {t('documents.btnGenerate')}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
