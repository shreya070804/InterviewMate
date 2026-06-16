import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { getUserFeedbackList } from '../firebase';
import type { Feedback } from '../types';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Calendar, Clock, Award, ArrowRight, TrendingUp } from 'lucide-react';

export const History: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<Feedback[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const list = await getUserFeedbackList(user.uid);
        
        // Sort chronologically for the chart
        const sortedList = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        setHistoryData(sortedList);
      } catch (err) {
        console.error("Error loading feedback history:", err);
      } finally {
        // Add a slight artificial delay to show off the skeletons
        setTimeout(() => setLoading(false), 800);
      }
    };

    fetchHistory();
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Score Progression Over Time</h2>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10} 
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}
                      labelClassName="text-slate-500 font-bold"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#006865" 
                      strokeWidth={3} 
                      dot={{ r: 4, strokeWidth: 2, stroke: '#006865', fill: '#ffffff' }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#006865' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

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
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
