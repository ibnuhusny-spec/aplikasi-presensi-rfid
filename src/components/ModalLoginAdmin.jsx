import React, { useState } from 'react';
import { getAdminPassword } from '../lib/supabase';
import { Lock, KeyRound, X, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function ModalLoginAdmin({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    const currentPass = getAdminPassword();
    
    if (password === currentPass) {
      setErrorMsg('');
      setPassword('');
      onSuccess();
    } else {
      setErrorMsg('Password Admin salah! Silakan coba lagi.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        

        <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Akses Admin Dilindungi</h3>
              <p className="text-xs text-slate-400">Masukkan Password Admin untuk melanjutkan</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" /> Password Admin:
            </label>
            
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Masukkan Password Admin (default: admin123)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 mt-2 font-medium bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-center">
                {errorMsg}
              </p>
            )}
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/30"
            >
              <ShieldCheck className="w-4 h-4" /> Masuk Admin
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-500">
            Password bawaan pertama kali: <code className="text-cyan-400">admin123</code>. Anda dapat mengubahnya di Kelola User.
          </p>
        </div>

      </div>
    </div>
  );
}
