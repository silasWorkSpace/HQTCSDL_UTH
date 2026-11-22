import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '48px 24px', maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #fee2e2',
              padding: '32px 24px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                padding: '12px',
                backgroundColor: '#fef2f2',
                borderRadius: '50%',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={36} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: '0 0 8px 0' }}>
              Không thể tải nội dung
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px 0', wordBreak: 'break-word' }}>
              {this.state.error?.message || 'Đã xảy ra sự cố không mong muốn trong quá trình kết xuất giao diện.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReset}
                className="ld-btn ld-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={15} />
                <span>Tải lại trang</span>
              </button>
              <a
                href="/reviews"
                className="ld-btn ld-btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                Về danh sách duyệt
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
