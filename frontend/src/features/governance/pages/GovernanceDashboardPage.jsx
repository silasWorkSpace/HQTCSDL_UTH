import React, { useState, useEffect } from 'react';
import { governanceApi } from '../api';
import { FileText, CheckCircle, AlertTriangle, Activity, Download, RefreshCw } from 'lucide-react';

export default function GovernanceDashboardPage({ activeRole: _activeRole }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await governanceApi.getHealthDashboard();
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không thể tải bảng điều khiển');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleExportCsv = async (type) => {
    try {
      setExporting(true);
      const csvData = type === 'compliance'
        ? await governanceApi.exportComplianceReportCsv()
        : await governanceApi.exportHealthReportCsv();

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Lỗi xuất báo cáo: ' + (err?.message || 'Thử lại sau'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
            Quản trị & Sức khỏe Tài liệu (Governance)
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
            Theo dõi độ tươi mới, độ phủ, cảnh báo drift và sức khỏe tài liệu toàn hệ thống
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            onClick={() => handleExportCsv('health')}
            disabled={exporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: 'var(--ld-primary, #2563eb)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <Download size={14} />
            Xuất CSV Sức khỏe
          </button>
          <button
            onClick={() => handleExportCsv('compliance')}
            disabled={exporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <Download size={14} />
            Xuất CSV Tuân thủ
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '6px', color: '#991b1b', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
          Đang tải chỉ số sức khỏe tài liệu...
        </div>
      )}

      {data && (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Tổng tài liệu</span>
                <FileText size={18} color="#3b82f6" />
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#111827', marginTop: '8px' }}>
                {data.totalDocuments || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>
                {data.publishedDocuments || 0} đã xuất bản (Published)
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Độ tươi mới (Freshness)</span>
                <CheckCircle size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#111827', marginTop: '8px' }}>
                {data.freshnessScore}%
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Cập nhật trong 30 ngày qua
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Độ phủ (Coverage)</span>
                <Activity size={18} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#111827', marginTop: '8px' }}>
                {data.coverageScore}%
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Kho mã nguồn có tài liệu
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Cảnh báo Drift mở</span>
                <AlertTriangle size={18} color="#ef4444" />
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: data.openDriftAlerts > 0 ? '#dc2626' : '#111827', marginTop: '8px' }}>
                {data.openDriftAlerts || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Cần kiểm tra hoặc cập nhật
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Độ tin cậy TB (AI)</span>
                <CheckCircle size={18} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#111827', marginTop: '8px' }}>
                {Math.round((data.averageConfidence || 0.88) * 100)}%
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Chất lượng gợi ý & draft AI
              </div>
            </div>
          </div>

          {/* Repository Health Table */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '28px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Điểm số Sức khỏe Kho mã nguồn (Repository Scores)
              </h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Kho mã nguồn</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Trạng thái</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Số tài liệu</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Drift mở</th>
                  <th style={{ padding: '12px 20px', fontWeight: '600' }}>Điểm sức khỏe</th>
                </tr>
              </thead>
              <tbody>
                {(!data.repositoryScores || data.repositoryScores.length === 0) ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px 20px', textAlign: 'center', color: '#9ca3af' }}>
                      Chưa có kho mã nguồn nào được kết nối trong workspace này.
                    </td>
                  </tr>
                ) : (
                  data.repositoryScores.map((repo) => {
                    const score = repo.healthScore || 0;
                    const scoreColor = score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626';
                    return (
                      <tr key={repo.repositoryId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '14px 20px', fontWeight: '500', color: '#111827' }}>
                          {repo.repositoryName}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: repo.status === 'connected' ? '#ecfdf5' : '#f3f4f6',
                            color: repo.status === 'connected' ? '#065f46' : '#4b5563',
                          }}>
                            {repo.status || 'connected'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', color: '#374151' }}>{repo.documentCount}</td>
                        <td style={{ padding: '14px 20px', color: repo.openDriftCount > 0 ? '#dc2626' : '#374151', fontWeight: repo.openDriftCount > 0 ? '600' : '400' }}>
                          {repo.openDriftCount}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '80px', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${score}%`, height: '100%', backgroundColor: scoreColor }} />
                            </div>
                            <span style={{ fontWeight: '600', color: scoreColor }}>{Math.round(score)}/100</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
