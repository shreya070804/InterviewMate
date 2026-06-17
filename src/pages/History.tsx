import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { getUserFeedbackPaginated } from '../firebase';
import type { Feedback } from '../types';
import { SessionHistoryChart } from '../components/SessionHistoryChart';
import { Calendar, Clock, Award, ArrowRight } from 'lucide-react';

export const History: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<Feedback[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadData = async (isFirstLoad = false) => {
    if (!user) return;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const currentLastDoc = isFirstLoad ? null : lastDoc;
      const res = await getUserFeedbackPaginated(user.uid, currentLastDoc, 10);
      
      setHistoryData(prev => isFirstLoad ? res.items : [...prev, ...res.items]);
      setLastDoc(res.lastVisible);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error("Error loading feedback history:", err);
    } finally {
      if (isFirstLoad) {
        setTimeout(() => setLoading(false), 800);
      } else {
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    loadData(true);
  }, [user]);

  // If there are no sessions, seed mock data so the history screen displays a beautiful chart
  const getDisplayData = () => {
    if (historyData.length > 0) {
      return historyData.map(f => ({
        ...f,
        averageScore: Number(((f.scores.correctness + f.scores.efficiency + f.scores.communication) / 3).toFixed(1))
      }));
    }

    // High fidelity seed backup
    return [
      {
        sessionId: 'mock-1',
        topic: 'DSA Interview',
        date: '2026-06-01',
        duration: 45,
        reviewerId: 'Alex C.',
        scores: { correctness: 6, efficiency: 5, communication: 7 },
        averageScore: 6.0,
        summary: 'Good start. Need to optimize loops.'
      },
      {
        sessionId: 'mock-2',
        topic: 'System Design',
        date: '2026-06-04',
        duration: 60,
        reviewerId: 'Priya M.',
        scores: { correctness: 7, efficiency: 7, communication: 8 },
        averageScore: 7.3,
        summary: 'Excellent load balancer architecture.'
      },
      {
        sessionId: 'mock-3',
        topic: 'Frontend Design',
        date: '2026-06-06',
        duration: 45,
        reviewerId: 'John D.',
        scores: { correctness: 8, efficiency: 6, communication: 8 },
        averageScore: 7.3,
        summary: 'Strong React optimization.'
      },
      {
        sessionId: 'mock-4',
        topic: 'DSA Interview',
        date: '2026-06-09',
        duration: 45,
        reviewerId: 'Alex C.',
        scores: { correctness: 8, efficiency: 8, communication: 9 },
        averageScore: 8.3,
        summary: 'Brilliant O(N) hashtable solution.'
      }
    ];
  };

  const chartData = getDisplayData().map(item => ({
    name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: item.averageScore
  }));

  const handleRowClick = (sessId: string) => {
    if (sessId.startsWith('mock-')) {
      alert("This is a demo review. Complete a real session to generate authentic feedback!");
      return;
    }
    navigate(`/feedback/${sessId}`);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5 mb-8">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Session History</h1>
          <p className="mt-1 text-xs text-slate-500">
            Monitor your progress metrics and review feedbacks from past mock sessions.
          </p>
        </div>

        {loading ? (
          /* SKELETON LOADING VIEW */
          <div className="space-y-8 animate-pulse">
            {/* Chart Skeleton */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-5 w-48 rounded bg-slate-200 mb-6"></div>
              <div className="h-64 w-full rounded bg-slate-100"></div>
            </div>
            
            {/* Table Rows Skeletons */}
            <div className="space-y-4">
              <div className="h-5 w-36 rounded bg-slate-200"></div>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between border border-slate-200 rounded-xl bg-white p-5">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 shrink-0"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-48 rounded bg-slate-200"></div>
                      <div className="h-3 w-36 rounded bg-slate-100"></div>
                    </div>
                  </div>
                  <div className="h-6 w-16 rounded bg-slate-200"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Recharts Score Progress Chart Card */}
            <SessionHistoryChart data={chartData} />

            {/* Past Sessions List */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Session Details</h2>
              <div className="space-y-3">
                {getDisplayData().map((item) => (
                  <div
                    key={item.sessionId}
                    onClick={() => handleRowClick(item.sessionId)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-slate-50 p-2.5 shrink-0 border border-slate-100">
                        <Calendar className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{item.topic}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">Reviewer: {item.reviewerId}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" /> {item.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" /> {item.duration} mins
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 sm:self-center">
                      <div className="flex items-center gap-1">
                        <Award className="h-4 w-4 text-brand" />
                        <span className="text-sm font-bold text-slate-800">{item.averageScore}/10</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => loadData(false)}
                    disabled={loadingMore}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 text-xs transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
