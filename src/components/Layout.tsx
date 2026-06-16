import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './Navbar';
import { useAuth } from '../context/AuthContext';
import { submitUserFeedback } from '../firebase';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  X, 
  Send, 
  CheckCircle 
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  showNavbar?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, showNavbar = true }) => {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'bug' | 'feature'>('bug');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitUserFeedback({
        type: activeTab,
        message: message.trim(),
        userId: user?.uid || 'anonymous',
        userEmail: profile?.email || user?.email || 'anonymous',
        currentPage: window.location.href
      });

      setMessage('');
      setIsOpen(false);
      setShowToast(true);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfc] dark:bg-slate-950 dark:text-slate-100 relative">
      {showNavbar && <Navbar />}
      <motion.main
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="grow flex flex-col"
      >
        {children}
      </motion.main>

      {/* Floating Feedback Widget */}
      <div className="fixed bottom-6 right-6 z-999">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-full bg-slate-905 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 px-4 py-2.5 text-xs font-bold shadow-lg transition-all cursor-pointer hover:scale-105 border border-slate-750 dark:border-slate-350"
        >
          <MessageSquare className="h-4 w-4 text-brand dark:text-brand" />
          <span>Feedback</span>
        </button>

        {/* Popover */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-14 right-0 mb-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 text-left text-slate-800 dark:text-slate-100 font-sans z-1000"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-550 dark:text-slate-450">
                  Submit Feedback
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mt-4 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('bug')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'bug'
                      ? 'bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-750 dark:hover:text-slate-200'
                  }`}
                >
                  <Bug className="h-3.5 w-3.5" />
                  <span>Report a Bug</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('feature')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'feature'
                      ? 'bg-white dark:bg-slate-800 text-brand shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-750 dark:hover:text-slate-200'
                  }`}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>Suggest Feature</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    placeholder={
                      activeTab === 'bug'
                        ? 'Describe what went wrong, steps to reproduce, or error messages...'
                        : 'What feature or improvement would you suggest to improve your prep?'
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={!message.trim() || isSubmitting}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white py-2.5 text-xs font-bold shadow-sm transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Feedback'}</span>
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-20 right-6 bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-4 py-3 rounded-2xl shadow-xl z-1000 text-xs font-bold flex items-center gap-2 border border-slate-850 dark:border-slate-100"
            >
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400 dark:text-emerald-550 shrink-0" />
              <span>Thanks, got it!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
