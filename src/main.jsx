import React from 'react'
import ReactDOM from 'react-dom/client'
import AplikasiPresensi from './AplikasiPresensi.jsx'
import './index.css'

class SafeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("SafeErrorBoundary caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      try {
        localStorage.removeItem('presensi_school_settings');
        localStorage.removeItem('presensi_mock_pengguna_list');
      } catch (e) {}
      return <AplikasiPresensi />;
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
