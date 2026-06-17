import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const ErrorFallback: React.FC = () => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-slate-900/40 p-8 md:p-12 max-w-md w-full text-center shadow-2xl backdrop-blur-md">
        {/* Glow Accent */}
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-red-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center relative z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 p-0.5 shadow-lg mb-6 border border-red-500/30">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight bg-linear-to-r from-red-400 via-rose-300 to-indigo-300 bg-clip-text text-transparent">
            Something went wrong
          </h1>
          
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            An unexpected error occurred in the application interface. The error has been logged automatically, and our engineering team is on it.
          </p>

          <button
            onClick={handleReload}
            className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-extrabold px-6 py-3 text-xs tracking-wider uppercase transition-all shadow-md hover:shadow-red-500/20 cursor-pointer border-none outline-none"
          >
            <RefreshCw className="h-4 w-4 animate-spin" style={{ animationDuration: '6s' }} /> Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};
