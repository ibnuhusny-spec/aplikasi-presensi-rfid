import React from 'react'
import ReactDOM from 'react-dom/client'
import AplikasiPresensi from './AplikasiPresensi.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl max-w-md shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-lg font-bold text-white">Aplikasi Presensi Diperbarui</h1>
            <p className="text-xs text-slate-400">
              Sistem telah mendeteksi versi baru atau penyimpanan lokal yang perlu disegarkan.
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                } catch (e) {
                  console.warn("Storage clear exception ignored:", e);
                }
                window.location.href = window.location.origin + window.location.pathname + '?r=' + Date.now();
              }}
              className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer select-none touch-manipulation"
            >
              🔄 Refresh & Reset Penyimpanan Browser
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
    <ErrorBoundary>
      <AplikasiPresensi />
    </ErrorBoundary>
  </React.StrictMode>,
)
