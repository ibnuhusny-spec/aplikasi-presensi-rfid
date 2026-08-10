import React from 'react'
import ReactDOM from 'react-dom/client'
import AplikasiPresensi from './AplikasiPresensi.jsx'
import './index.css'

class SafeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("SafeErrorBoundary caught error:", error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('presensi_school_settings');
      localStorage.removeItem('presensi_mock_pengguna_list');
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: '#020617',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif"
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '24px',
            padding: '32px 24px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📡</div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px' }}>
              Sistem Presensi RFID
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px', lineHeight: '1.5' }}>
              Terjadi kendala teknis sementara saat memuat aplikasi. Anda dapat memulihkan dan mereset sistem ke kondisi stabil secara instan.
            </p>
            <button
              onClick={this.handleReset}
              style={{
                width: '100%',
                padding: '14px 20px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              🔄 Pulihkan & Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SafeErrorBoundary>
      <AplikasiPresensi />
    </SafeErrorBoundary>
  </React.StrictMode>,
)

