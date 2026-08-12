import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { normalizeTo24Hour } from '../utils/settings';

export default function TimeInput24h({ value, onChange, className = '', title = 'Pilih waktu 24 jam', isDark = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const formattedValue = normalizeTo24Hour(value || '13:00', 'pulang');
  const [hStr, mStr] = formattedValue.split(':');
  const currentHour = parseInt(hStr || '13', 10);
  const currentMinute = parseInt(mStr || '00', 10);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHourSelect = (h) => {
    const newH = String(h).padStart(2, '0');
    const newM = String(currentMinute).padStart(2, '0');
    onChange(`${newH}:${newM}`);
  };

  const handleMinuteSelect = (m) => {
    const newH = String(currentHour).padStart(2, '0');
    const newM = String(m).padStart(2, '0');
    onChange(`${newH}:${newM}`);
    setIsOpen(false);
  };

  const hoursList = Array.from({ length: 24 }, (_, i) => i);
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={title}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs border transition-all cursor-pointer select-none ${
          className || (isDark 
            ? 'bg-slate-950 text-cyan-300 border-slate-700 hover:border-cyan-500' 
            : 'bg-white text-teal-800 border-teal-300 hover:border-teal-500 hover:bg-teal-50/80 shadow-sm')
        }`}
      >
        <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-cyan-400' : 'text-teal-600'}`} />
        <span>{formattedValue} WITA</span>
      </button>

      {isOpen && (
        <div className={`absolute left-0 top-full mt-1.5 z-50 border shadow-2xl rounded-2xl p-3 w-64 animate-in fade-in zoom-in-95 ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
        }`}>
          <div className={`text-[10px] uppercase font-mono font-bold mb-2 flex justify-between items-center border-b pb-1.5 ${
            isDark ? 'text-cyan-400 border-slate-800' : 'text-teal-700 border-slate-200'
          }`}>
            <span>Pilih Waktu (24 Jam)</span>
            <span className={`font-bold px-1.5 py-0.5 rounded ${
              isDark ? 'text-slate-950 bg-cyan-400' : 'text-white bg-teal-600'
            }`}>{formattedValue}</span>
          </div>

          <div className="space-y-2">
            <div>
              <p className={`text-[10px] mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Jam (00 - 23):</p>
              <div className="grid grid-cols-6 gap-1 max-h-28 overflow-y-auto pr-1">
                {hoursList.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourSelect(h)}
                    className={`py-1 rounded text-[11px] font-mono font-bold transition-all ${
                      currentHour === h
                        ? (isDark ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-teal-600 text-white shadow-md')
                        : (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-teal-100 hover:text-teal-900')
                    }`}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={`text-[10px] mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Menit:</p>
              <div className="grid grid-cols-6 gap-1">
                {minutesList.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteSelect(m)}
                    className={`py-1 rounded text-[11px] font-mono font-bold transition-all ${
                      currentMinute === m
                        ? (isDark ? 'bg-emerald-500 text-slate-950 shadow-md' : 'bg-emerald-600 text-white shadow-md')
                        : (isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-900')
                    }`}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
