import React, { useState, useEffect } from 'react';
import { governanceApi } from '../api';
import { Shield, Plus, Edit2, Trash2, CheckCircle2, Play } from 'lucide-react';

export default function PolicyManagementPage({ activeRole: _activeRole }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    policyType: 'drift',
    scopeLevel: 'WORKSPACE',
    scopeId: '',
    configLevel: 'TechLead',
    config: '{\n  "threshold": 0.85,\n  "minSeverity": "Medium",\n  "exclusionRules": ["tests/**", "*.spec.*"]\n}',
  });

  // Resolver Simulator state
  const [resolverParams, setResolverParams] = useState({
    policyType: 'drift',
    repositoryId: '',
    moduleName: '',
    docType: 'API_REFERENCE',
  });
  const [resolvedResult, setResolvedResult] = useState(null);
  const [resolving, setResolving] = useState(false);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await governanceApi.getPolicies({
        policyType: filterType || undefined,
        scopeLevel: filterScope || undefined,
      });
      setPolicies(res);
    } catch (err) {
      alert('Lỗi tải danh sách chính sách: ' + (err?.message || 'Thử lại sau'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [filterType, filterScope]);

  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setFormData({
      policyType: 'drift',
      scopeLevel: 'WORKSPACE',
      scopeId: '',
      configLevel: 'TechLead',
      config: '{\n  "threshold": 0.85,\n  "minSeverity": "Medium",\n  "exclusionRules": ["tests/**"]\n}',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditingPolicy(p);
    setFormData({
      policyType: p.policyType,
      scopeLevel: p.scopeLevel,
      scopeId: p.scopeId || '',
      configLevel: p.configLevel,
      config: typeof p.config === 'string' ? p.config : JSON.stringify(p.config, null, 2),
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa chính sách này?')) return;
    try {
      await governanceApi.deletePolicy(id);
      fetchPolicies();
    } catch (err) {
      alert('Không thể xóa chính sách: ' + (err?.message || 'Thử lại sau'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPolicy) {
        await governanceApi.updatePolicy(editingPolicy.id, {
          ...formData,
          scopeId: formData.scopeId ? formData.scopeId : undefined,
        });
      } else {
        await governanceApi.createPolicy({
          ...formData,
          scopeId: formData.scopeId ? formData.scopeId : undefined,
        });
      }
      setShowModal(false);
      fetchPolicies();
    } catch (err) {
      alert('Lỗi lưu chính sách: ' + (err?.response?.data?.message || err?.message || 'Kiểm tra lại JSON'));
    }
  };

  const handleResolve = async () => {
    try {
      setResolving(true);
      const res = await governanceApi.resolvePolicy({
        policyType: resolverParams.policyType,
        repositoryId: resolverParams.repositoryId ? resolverParams.repositoryId : undefined,
        moduleName: resolverParams.moduleName ? resolverParams.moduleName : undefined,
        docType: resolverParams.docType ? resolverParams.docType : undefined,
      });
      setResolvedResult(res);
    } catch (err) {
      alert('Lỗi tính toán chính sách: ' + (err?.message || 'Thử lại sau'));
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
            Quản lý Chính sách Hệ thống (Governance Policies)
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
            Thiết lập ngưỡng drift, quy tắc loại trừ (exclusion), phạm vi tự động cập nhật và phân cấp ưu tiên
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 16px',
            backgroundColor: 'var(--ld-primary, #2563eb)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          <Plus size={16} />
          Tạo chính sách mới
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
        >
          <option value="">Tất cả loại chính sách</option>
          <option value="drift">Ngưỡng Drift (drift)</option>
          <option value="auto_update">Phạm vi tự cập nhật (auto_update)</option>
          <option value="auto_apply">Tự động áp dụng (auto_apply)</option>
          <option value="manager_required_type">Yêu cầu Manager duyệt (manager_required_type)</option>
          <option value="merge">Quy tắc Merge (merge)</option>
          <option value="retention">Lưu trữ phiên bản (retention)</option>
        </select>

        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
        >
          <option value="">Tất cả phạm vi (Scope)</option>
          <option value="WORKSPACE">WORKSPACE (Toàn bộ)</option>
          <option value="REPOSITORY">REPOSITORY (Kho mã nguồn)</option>
          <option value="MODULE">MODULE (Mô-đun)</option>
          <option value="DOC_TYPE">DOC_TYPE (Loại tài liệu)</option>
        </select>
      </div>

      {/* Policies Table */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '36px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
              <th style={{ padding: '12px 18px', fontWeight: '600' }}>Loại chính sách</th>
              <th style={{ padding: '12px 18px', fontWeight: '600' }}>Phạm vi (Scope)</th>
              <th style={{ padding: '12px 18px', fontWeight: '600' }}>Cấp phê duyệt</th>
              <th style={{ padding: '12px 18px', fontWeight: '600' }}>Cấu hình (Config)</th>
              <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                  Đang tải chính sách...
                </td>
              </tr>
            ) : policies.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
                  Chưa có chính sách nào. Nhấn "Tạo chính sách mới" để thiết lập.
                </td>
              </tr>
            ) : (
              policies.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 18px', fontWeight: '600', color: '#1f2937' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                    }}>
                      {p.policyType}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px', color: '#4b5563' }}>
                    <strong>{p.scopeLevel}</strong>
                    {p.scopeId && <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af' }}>ID: {p.scopeId.substring(0, 8)}...</span>}
                  </td>
                  <td style={{ padding: '12px 18px', color: '#374151' }}>{p.configLevel}</td>
                  <td style={{ padding: '12px 18px', color: '#4b5563', maxWidth: '360px' }}>
                    <code style={{ fontSize: '11px', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.config}
                    </code>
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleOpenEdit(p)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', marginRight: '8px' }}
                      title="Chỉnh sửa"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                      title="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Policy Resolver Simulator */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Shield size={20} color="var(--ld-primary, #2563eb)" />
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
            Công cụ Tính toán Chính sách Hiệu lực (Policy Resolver Simulator)
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '18px' }}>
          Theo quy tắc kiến trúc LivingDocs: Thứ tự phân cấp <code>WORKSPACE &rarr; REPOSITORY &rarr; MODULE &rarr; DOC_TYPE</code>. Bộ giải quyết luôn chọn chính sách <strong>hạn chế hơn</strong> (khắt khe hơn) và trả về nguồn chính sách thắng cuộc.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              Loại chính sách
            </label>
            <select
              value={resolverParams.policyType}
              onChange={(e) => setResolverParams({ ...resolverParams, policyType: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
            >
              <option value="drift">drift</option>
              <option value="auto_update">auto_update</option>
              <option value="auto_apply">auto_apply</option>
              <option value="manager_required_type">manager_required_type</option>
              <option value="merge">merge</option>
              <option value="retention">retention</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              Kho mã nguồn (Repository UUID)
            </label>
            <input
              type="text"
              placeholder="Tùy chọn UUID"
              value={resolverParams.repositoryId}
              onChange={(e) => setResolverParams({ ...resolverParams, repositoryId: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              Mô-đun (Module path)
            </label>
            <input
              type="text"
              placeholder="ví dụ: payment-service"
              value={resolverParams.moduleName}
              onChange={(e) => setResolverParams({ ...resolverParams, moduleName: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
              Loại tài liệu (Doc Type)
            </label>
            <select
              value={resolverParams.docType}
              onChange={(e) => setResolverParams({ ...resolverParams, docType: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
            >
              <option value="API_REFERENCE">API_REFERENCE</option>
              <option value="README">README</option>
              <option value="MODULE_GUIDE">MODULE_GUIDE</option>
              <option value="ONBOARDING_GUIDE">ONBOARDING_GUIDE</option>
              <option value="ADR">ADR</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleResolve}
          disabled={resolving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: '#1f2937',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            marginBottom: '16px',
          }}
        >
          <Play size={14} />
          {resolving ? 'Đang tính toán...' : 'Tính toán Chính sách Hiệu lực'}
        </button>

        {resolvedResult && (
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <CheckCircle2 size={18} color="#059669" />
              <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>
                Phạm vi quyết định: <span style={{ color: '#2563eb' }}>{resolvedResult.winningScopeLevel}</span>
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#334155', marginBottom: '10px' }}>
              <strong>Lý do giải quyết:</strong> {resolvedResult.resolutionReason}
            </p>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
              Cấu hình hiệu lực (Effective Config):
            </div>
            <pre style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto', margin: 0 }}>
              {JSON.stringify(resolvedResult.effectiveConfig, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', width: '540px', maxWidth: '90%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginTop: 0, marginBottom: '16px', color: '#111827' }}>
              {editingPolicy ? 'Chỉnh sửa chính sách' : 'Tạo chính sách mới'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Loại chính sách</label>
                <select
                  value={formData.policyType}
                  onChange={(e) => setFormData({ ...formData, policyType: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                >
                  <option value="drift">drift</option>
                  <option value="auto_update">auto_update</option>
                  <option value="auto_apply">auto_apply</option>
                  <option value="manager_required_type">manager_required_type</option>
                  <option value="merge">merge</option>
                  <option value="retention">retention</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Phạm vi (Scope Level)</label>
                  <select
                    value={formData.scopeLevel}
                    onChange={(e) => setFormData({ ...formData, scopeLevel: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  >
                    <option value="WORKSPACE">WORKSPACE</option>
                    <option value="REPOSITORY">REPOSITORY</option>
                    <option value="MODULE">MODULE</option>
                    <option value="DOC_TYPE">DOC_TYPE</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Cấp phê duyệt</label>
                  <select
                    value={formData.configLevel}
                    onChange={(e) => setFormData({ ...formData, configLevel: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  >
                    <option value="Administrator">Administrator</option>
                    <option value="TechLead">TechLead</option>
                    <option value="Manager">Manager</option>
                    <option value="Developer">Developer</option>
                  </select>
                </div>
              </div>

              {formData.scopeLevel !== 'WORKSPACE' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Scope ID (UUID)</label>
                  <input
                    type="text"
                    value={formData.scopeId}
                    onChange={(e) => setFormData({ ...formData, scopeId: e.target.value })}
                    placeholder="ví dụ: repositoryId"
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Cấu hình JSON (Config)</label>
                <textarea
                  rows={6}
                  value={formData.config}
                  onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'monospace', fontSize: '12px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', backgroundColor: 'var(--ld-primary, #2563eb)', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                >
                  {editingPolicy ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
