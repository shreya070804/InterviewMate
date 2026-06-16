import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout showNavbar={false}>
      <div className="flex min-h-screen flex-col items-center justify-center bg-grid-pattern px-4 text-center">
        <div className="max-w-md space-y-6">
          <div className="flex justify-center text-slate-300">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <FileQuestion className="h-16 w-16 text-slate-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">404</h1>
            <h2 className="text-xl font-bold text-slate-700">Page not found</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              We couldn't find the page you're looking for. It might have been moved, deleted, or the URL might be incorrect.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-xs font-bold text-white hover:bg-brand-hover shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    </Layout>
  );
};
