import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { 
  getAdminMetrics, 
  getAdminFeedback, 
  getRecentSignups, 
  isAdmin 
} from '../firebase';
import type { AdminMetrics } from '../firebase';
import { 
  Users, 
  Calendar, 
  Sparkles, 
  Award, 
  ArrowLeft, 
  AlertCircle, 
  RefreshCw,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [signups, setSignups] = useState<any[]>([]);

  // Double check admin status client-side (route protection is in ProtectedRoute, but double safety is good)
  useEffect(() => {
    if (user && !isAdmin(user.email)) {
      navigate('/');
    }
  }, [user, navigate]);

  const loadAdminData = async () => {
    try {
      setError(null);
      const [metricsData, feedbackData, signupData] = await Promise.all([
        getAdminMetrics(),
        getAdminFeedback(),
        getRecentSignups()
      ]);
      setMetrics(metricsData);
      setFeedbacks(feedbackData);
      setSignups(signupData);
    } catch (err: any) {
      console.error("Failed to load admin telemetry data:", err);
      setError("Failed to fetch administrative metrics. Please check server status or credentials.");
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadAdminData();
      setLoading(false);
    };
    init();
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAdminData();
    setIsRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-8 font-sans transition-colors duration-200 text-slate-800 dark:text-slate-100">
        {/* Header Title Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-brand" /> Admin Command Center
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Platform-wide usage analytics, user feedback logs, and recent candidate registrations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-300 px-4 py-2 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to App
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-850 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Telemetry
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/20 dark:bg-red-950/10 p-4 text-red-750 dark:text-red-400 mb-8">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="text-xs leading-relaxed font-semibold">{error}</div>
          </div>
        )}

        {loading ? (
          <div className="space-y-8">
            {/* Metric Loader */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"></div>
              ))}
            </div>
            {/* Table Loader */}
            <div className="h-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"></div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 4 Metric Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Total Users */}
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.01]">
                <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-slate-400 dark:text-white">
                  <Users className="h-20 w-20" />
                </div>
                <div className="rounded-lg bg-teal-50 dark:bg-teal-950/30 p-3 text-brand">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Users</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{metrics?.totalUsers ?? 0}</p>
                </div>
              </div>

              {/* Card 2: Completed Sessions */}
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.01]">
                <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-slate-400 dark:text-white">
                  <Calendar className="h-20 w-20" />
                </div>
                <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-3 text-indigo-600 dark:text-indigo-400">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sessions Completed</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{metrics?.totalSessionsCompleted ?? 0}</p>
                </div>
              </div>

              {/* Card 3: AI Calls Today */}
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.01]">
                <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-slate-400 dark:text-white">
                  <Sparkles className="h-20 w-20" />
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI Calls (Today)</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{metrics?.totalAICallsToday ?? 0} / 50 limit</p>
                </div>
              </div>

              {/* Card 4: Average Score */}
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.01]">
                <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 text-slate-400 dark:text-white">
                  <Award className="h-20 w-20" />
                </div>
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3 text-rose-600 dark:text-rose-400">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Platform Score</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">
                    {metrics?.averageScore ? `${metrics.averageScore}/10` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Main grid section */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left Column: User Feedback Reports */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-brand" /> User Feedback Logs
                  </h2>
                  <span className="text-xs font-semibold text-slate-400">{feedbacks.length} reports</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  {feedbacks.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      <MessageSquare className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">No feedback reports submitted yet.</p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Page</th>
                          <th className="px-4 py-3">User / Email</th>
                          <th className="px-4 py-3">Message</th>
                          <th className="px-4 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
                        {feedbacks.map((fb) => (
                          <tr key={fb.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors">
                            <td className="whitespace-nowrap px-4 py-3.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                fb.type === 'bug' 
                                  ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300' 
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              }`}>
                                {fb.type}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 dark:text-slate-350 max-w-[120px] truncate" title={fb.currentPage}>
                              {fb.currentPage || '/'}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{fb.userEmail}</p>
                              <p className="text-[10px] text-slate-400 font-mono">UID: {fb.userId?.substring(0, 8)}...</p>
                            </td>
                            <td className="px-4 py-3.5 text-slate-650 dark:text-slate-350 max-w-[220px] whitespace-pre-wrap">
                              {fb.message}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-slate-450 dark:text-slate-500 text-[10px] font-mono">
                              {formatDate(fb.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Column: 10 Recent Signups */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-550" /> Recent Signups
                  </h2>
                  <span className="text-xs font-semibold text-slate-400">Latest 10</span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  {signups.length === 0 ? (
                    <div className="py-12 text-center text-slate-500">
                      <Users className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold">No users registered yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-850">
                      {signups.map((usr) => (
                        <div key={usr.uid} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors flex flex-col gap-1 text-xs">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-800 dark:text-white truncate">
                              {usr.displayName || 'Developer'}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-550 self-center shrink-0 ml-2">
                              {formatDate(usr.createdAt).split(' ')[0]}
                            </span>
                          </div>
                          <span className="text-slate-500 dark:text-slate-400 truncate font-mono text-[10px]">
                            {usr.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
