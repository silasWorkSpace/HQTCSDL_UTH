import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { documentsApi } from '../api';

export default function GenerateDocModal({ isOpen, onClose, onGenerated }) {
  const onGeneratedRef = useRef(onGenerated);
  onGeneratedRef.current = onGenerated;
  const [repos, setRepos] = useState([]);
  const [repositoryId, setRepositoryId] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [scopeType, setScopeType] = useState('REPOSITORY');
  const [scopeReference, setScopeReference] = useState('repository');
  const [entities, setEntities] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState('');
  const [pathInRepo, setPathInRepo] = useState('docs/generated.md');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    setPathInRepo(`docs/guide-${randomSuffix}.md`);
    documentsApi.getRepositories().then((items) => {
      setRepos(items);
      setRepositoryId((current) => current || items[0]?.id || '');
    }).catch((e) => setError(e?.detail || e?.message || 'Không tải được repository.'));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !repositoryId) return;
    let active = true;
    setLoading(true);
    setError('');
    setEntities([]);
    setSelectedIds([]);
    setCommitSha('');
    setScopeType('REPOSITORY');
    setScopeReference('repository');
    documentsApi.getAnalysisRuns(repositoryId).then(async (runs) => {
      const completed = runs.find((run) => run.status === 'completed' && run.headCommitSha);
      if (!completed) throw new Error('Chưa có lần phân tích hoàn tất cho repository này. Hãy chờ phân tích ban đầu hoặc webhook chạy xong.');
      const indexed = await documentsApi.getCodeEntities(repositoryId, completed.headCommitSha);
      if (!active) return;
      setCommitSha(completed.headCommitSha);
      setEntities(indexed);
      setTitle(`Tài liệu ${repos.find((repo) => String(repo.id) === String(repositoryId))?.name || 'repository'}`);
      setSelectedIds([]);
      if (!indexed.length) setError('Snapshot này chưa có code entity. Hãy chạy lại phân tích repository.');
    }).catch((e) => { if (active) setError(e?.detail || e?.message || 'Không tải được entity đã phân tích.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, repositoryId, repos]);

  const scopeOptions = useMemo(() => {
    const paths = [...new Set(entities.map((entity) => entity.filePath).filter(Boolean))].sort();
    if (scopeType === 'FILE') return paths;
    if (scopeType === 'MODULE') {
      return [...new Set(paths.flatMap((path) => {
        const parts = path.split('/');
        return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
      }))].sort();
    }
    return [];
  }, [entities, scopeType]);

  const scopedEntities = useMemo(() => entities.filter((entity) => {
      const inScope = scopeType === 'REPOSITORY' || (scopeType === 'FILE'
        ? entity.filePath === scopeReference
        : entity.filePath?.startsWith(`${scopeReference}/`));
      return inScope;
  }), [entities, scopeReference, scopeType]);

  const visibleEntities = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scopedEntities.filter((entity) => !needle || [entity.name, entity.kind, entity.filePath, entity.signature]
        .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [query, scopedEntities]);

  useEffect(() => {
    if (!isOpen || !jobId || job?.status === 'completed' || job?.status === 'failed') return undefined;
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const current = await documentsApi.getGenerationJob(jobId);
        if (!active) return;
        setJob(current);
        if (current.status === 'completed') {
          setNotice('Tài liệu nháp đã được tạo.');
          onGeneratedRef.current?.(current);
        } else if (current.status === 'failed') {
          setError(current.errorMessage || 'AI không thể tạo tài liệu sau các lần thử tự động.');
        } else {
          setNotice(current.nextRetryAt ? `AI đang thử lại. Lần tiếp theo: ${new Date(current.nextRetryAt).toLocaleTimeString()}.` : `AI đang xử lý (${current.status}).`);
          timer = window.setTimeout(poll, 2000);
        }
      } catch (e) {
        if (!active) return;
        setError(e?.detail || e?.message || 'Không theo dõi được trạng thái job.');
        timer = window.setTimeout(poll, 5000);
      }
    };
    poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [isOpen, jobId, job?.status]);

  if (!isOpen) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!repositoryId || !commitSha) return setError('Chọn repository đã phân tích hoàn tất.');
    if (scopeType !== 'REPOSITORY' && !scopeReference) return setError('Chọn file hoặc module cần sinh tài liệu.');
    if (selectedIds.length && selectedIds.some((id) => !scopedEntities.some((entity) => entity.id === id))) return setError('Các entity đã chọn không thuộc phạm vi hiện tại.');
    const path = pathInRepo.trim();
    if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => !part || part === '.' || part === '..')) return setError('Đường dẫn phải tương đối và không chứa đoạn . hoặc ..');
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await documentsApi.generateDocument({ repositoryId, commitSha, scopeType, scopeReference, codeEntityIds: selectedIds, title: title.trim(), pathInRepo: path });
      setJobId(result.jobId);
      setJob({ jobId: result.jobId, status: 'pending' });
      setNotice(`Đã gửi yêu cầu (${result.jobId}). Đang chờ AI xử lý…`);
    } catch (e) {
      setError(e?.detail || e?.response?.data?.detail || e?.message || 'Không gửi được yêu cầu sinh tài liệu.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="ld-modal-overlay">
      <section className="ld-modal" style={{ maxWidth: 760, maxHeight: '90vh', overflow: 'auto' }} role="dialog" aria-modal="true" aria-labelledby="create-document-title">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 id="create-document-title" style={{ margin: 0, fontSize: 17 }}>Sinh tài liệu từ code đã phân tích</h2>
          <button type="button" className="ld-btn ld-btn-ghost" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>
        <form onSubmit={submit} style={{ padding: 20, display: 'grid', gap: 14 }}>
          <label className="ld-label">Repository
            <select className="ld-select" value={repositoryId} onChange={(e) => setRepositoryId(e.target.value)} required>
              <option value="">Chọn repository</option>
              {repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.fullName || repo.full_name || repo.name}</option>)}
            </select>
          </label>
          {commitSha && <small>Snapshot: <code>{commitSha}</code></small>}
          <label className="ld-label">Phạm vi code
            <select className="ld-select" value={scopeType} onChange={(e) => {
              const nextType = e.target.value;
              setScopeType(nextType);
              setScopeReference(nextType === 'REPOSITORY' ? 'repository' : '');
              setSelectedIds([]);
            }}>
              <option value="FILE">Một file</option>
              <option value="MODULE">Module / package</option>
              <option value="REPOSITORY">Toàn repository</option>
            </select>
          </label>
          {scopeType !== 'REPOSITORY' && <label className="ld-label">{scopeType === 'FILE' ? 'File' : 'Thư mục module / package'}
            <select className="ld-select" value={scopeReference} onChange={(e) => { setScopeReference(e.target.value); setSelectedIds([]); }} required>
              <option value="">Chọn phạm vi</option>
              {scopeOptions.map((path) => <option key={path} value={path}>{path}</option>)}
            </select>
          </label>}
          <label className="ld-label">Tiêu đề
            <input className="ld-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </label>
          <label className="ld-label">Đường dẫn tài liệu trong repository
            <input className="ld-input" value={pathInRepo} onChange={(e) => setPathInRepo(e.target.value)} required />
          </label>
          <label className="ld-label">Lọc code entity (tùy chọn thu hẹp phạm vi)
            <input className="ld-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên, loại, file hoặc signature" />
          </label>
          <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
            {loading ? <p>Đang tải snapshot đã phân tích…</p> : visibleEntities.map((entity) => (
              <label key={entity.id} style={{ display: 'flex', gap: 10, padding: '8px 4px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedIds.includes(entity.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, entity.id] : ids.filter((id) => id !== entity.id))} />
                <span><strong>{entity.name}</strong> <small>{entity.kind}</small><br /><small>{entity.filePath}{entity.signature ? ` · ${entity.signature}` : ''}</small></span>
              </label>
            ))}
            {!loading && !visibleEntities.length && <p style={{ color: '#64748b' }}>Không có entity phù hợp trong snapshot này.</p>}
          </div>
          <small>{selectedIds.length ? `AI nhận ${selectedIds.length} entity được chọn trong phạm vi và snapshot này.` : `AI nhận toàn bộ ${scopedEntities.length} entity trong phạm vi đã chọn.`} Để trống lựa chọn entity để dùng toàn bộ phạm vi.</small>
          {error && <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>}
          {notice && <div role="status" style={{ color: '#166534', fontSize: 13 }}>{notice}</div>}
          {job?.status === 'completed' && job.resultDocumentId && <Link to={`/documents/${job.resultDocumentId}/edit`} onClick={onClose}>Mở bản nháp để xem và chỉnh sửa</Link>}
          {job?.status === 'failed' && job.inDlq && <button type="button" className="ld-btn ld-btn-secondary" disabled={submitting} onClick={async () => {
            setSubmitting(true); setError('');
            try { const retried = await documentsApi.retryGenerationJob(jobId); setJob(retried); setNotice('Đã xếp job vào hàng đợi thử lại.'); }
            catch (e) { setError(e?.detail || e?.message || 'Không thể thử lại job.'); }
            finally { setSubmitting(false); }
          }}>Thử lại</button>}
          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="ld-btn ld-btn-secondary" onClick={onClose}>Đóng</button>
            <button type="submit" className="ld-btn ld-btn-primary" disabled={loading || submitting || Boolean(jobId) || !entities.length}>{submitting ? 'Đang gửi…' : 'Sinh bản nháp'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
