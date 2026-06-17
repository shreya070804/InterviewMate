import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { getUserFeedbackList, checkApiUsage, incrementApiUsage, showToast } from '../firebase';
import { WeakAreaCard } from '../components/WeakAreaCard';
import type { Feedback } from '../types';
import { Brain, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

const computeAvg = (fb: Feedback) =>
  (fb.scores.correctness + fb.scores.efficiency + fb.scores.communication) / 3;

const getCleanCategory = (topic: string): string => {
  const t = topic.toUpperCase();
  if (t.includes('DSA')) return 'DSA';
  if (t.includes('SYSTEM DESIGN') || t.includes('ARCHITECTURE')) return 'System Design';
  if (t.includes('FRONTEND') || t.includes('WEB') || t.includes('FRONT END')) return 'Frontend';
  if (t.includes('HR') || t.includes('BEHAVIORAL') || t.includes('BEHAVIOURAL')) return 'HR';
  return topic;
};

export const SkillGapTracker: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [weakAreas, setWeakAreas] = useState<
    { category: string; avgScore: number; topics: string[] }[]
  >([]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const feedbackList = await getUserFeedbackList(user.uid);

      if (feedbackList.length === 0) {
        // Safe default prefill when user has no session history
        setWeakAreas([
          {
            category: 'DSA',
            avgScore: 0,
            topics: [
              'Understand basic time and space complexity (Big-O notation)',
              'Practice foundational array, string, and hash map manipulation',
              'Learn common sorting algorithms and basic binary search patterns'
            ]
          },
          {
            category: 'System Design',
            avgScore: 0,
            topics: [
              'Explore standard client-server request-response lifecycles',
              'Understand key differences between SQL (Relational) and NoSQL databases',
              'Study vertical vs horizontal scaling techniques and basic load balancer types'
            ]
          }
        ]);
        return;
      }

      // Group feedback scores by category
      const categoryMap: Record<string, { total: number; count: number }> = {};
      feedbackList.forEach((fb) => {
        const cat = getCleanCategory(fb.topic);
        const avg = computeAvg(fb);
        if (!categoryMap[cat]) {
          categoryMap[cat] = { total: 0, count: 0 };
        }
        categoryMap[cat].total += avg;
        categoryMap[cat].count += 1;
      });

      const scoresByCategory: Record<string, number> = {};
      for (const [cat, data] of Object.entries(categoryMap)) {
        scoresByCategory[cat] = parseFloat((data.total / data.count).toFixed(2));
      }

      const n = feedbackList.length;
      const apiKey = localStorage.getItem('im_claude_key') || import.meta.env.VITE_ANTHROPIC_API_KEY || '';

      if (apiKey) {
        try {
          if (user) {
            await checkApiUsage(user.uid);
          }
          const userPrompt = `Based on these category-wise average scores over the last ${n} sessions: ${JSON.stringify(scoresByCategory)}, identify the user's top 2 weakest areas and suggest 3 specific topics to study for each. Return JSON with weak_areas (array of objects with category, avg_score, study_topics array).`;

          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
              'dangerously-allow-html-user-override': 'true'
            } as any,
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1000,
              messages: [{ role: 'user', content: userPrompt }],
              system: "You identify candidate skill gaps. Respond ONLY with a valid JSON block containing: { \"weak_areas\": [ { \"category\": string, \"avg_score\": number, \"study_topics\": string[] } ] }."
            })
          });

          if (response.ok) {
            const responseData = await response.json();
            
            if (user) {
              await incrementApiUsage(user.uid);
            }

            const jsonText = responseData.content[0].text;
            const parsed = JSON.parse(jsonText.replace(/```json/g, '').replace(/```/g, '').trim());

            if (parsed && Array.isArray(parsed.weak_areas)) {
              const enriched = parsed.weak_areas.map((w: any) => ({
                category: w.category,
                avgScore: typeof w.avg_score === 'number' ? w.avg_score : parseFloat(w.avg_score) || 0,
                topics: Array.isArray(w.study_topics) ? w.study_topics : [],
              }));
              setWeakAreas(enriched);
              return;
            }
          }
        } catch (err: any) {
          console.warn('Claude API failed to fetch skill gaps, using local analysis fallback:', err);
          if (err.message && err.message.includes('limit reached')) {
            showToast(err.message, 'error');
          }
        }
      }

      // Local fallback calculation if API fails or no key
      const categoryAverages = Object.entries(categoryMap).map(([cat, data]) => ({
        category: cat,
        avgScore: data.total / data.count,
      }));

      const sorted = categoryAverages.sort((a, b) => a.avgScore - b.avgScore);
      const weakest = sorted.slice(0, 2);

      const fallbackTopics: Record<string, string[]> = {
        'DSA': [
          'Dynamic Programming & Memoization patterns',
          'Graph Traversals and search algorithms (BFS/DFS)',
          'Sliding Window & Two Pointer array optimizations'
        ],
        'System Design': [
          'Database Sharding & Partitioning strategies',
          'Load Balancing & API Gateway Rate Limiting',
          'Caching Architectures and eviction policies (Redis)'
        ],
        'Frontend': [
          'React Component Lifecycle & Rendering Performance',
          'CSS Flexbox/Grid systems & Responsive Design paradigms',
          'Advanced State Management & Context API optimization'
        ],
        'HR': [
          'STAR Method formulation for leadership answers',
          'Structured conflict-resolution story structure',
          'Clear, pacing-regulated technical communication'
        ]
      };

      const enriched = weakest.map((w) => {
        const cleanCat = getCleanCategory(w.category);
        const topics = fallbackTopics[cleanCat] || fallbackTopics[w.category] || [
          'Deep dive into structural fundamentals',
          'Practice solving similar technical challenges',
          'Perform code walkthroughs with senior peers'
        ];
        return {
          category: w.category,
          avgScore: w.avgScore,
          topics
        };
      });

      setWeakAreas(enriched);
    } catch (err) {
      console.error('Error fetching skill gaps:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    init();
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handlePractice = (category: string) => {
    navigate('/solo', { state: { prefillTopic: category } });
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8 font-sans transition-colors duration-200">
        {/* Header Title Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
              <Brain className="h-7 w-7 text-brand" /> Skill Gap Tracker
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              AI-driven insights analyzing your past sessions and highlighting study topics to focus on.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-300 px-4 py-2 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Analyze Performance
          </button>
        </div>

        {/* Loader skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm animate-pulse space-y-4">
                <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-4/5 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
                <div className="h-10 w-1/2 bg-slate-200 dark:bg-slate-800 rounded pt-2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dynamic Message banner */}
            {weakAreas.length > 0 && weakAreas[0].avgScore === 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/20 p-4 text-blue-750 dark:text-blue-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-blue-500" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold">Welcome to InterviewMate!</span> You haven't completed any sessions yet, so we have initialized standard skill tracks (DSA and System Design) to get you started. Take mock sessions or practice now to begin tracking real averages!
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-teal-100 dark:border-teal-900/30 bg-teal-50/20 dark:bg-teal-950/10 p-4 text-teal-800 dark:text-teal-300">
                <Sparkles className="h-5 w-5 shrink-0 text-teal-500" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold">Real-time analysis updated!</span> Claude analyzed your score sheet. Focus on the study topics below to level up your weakest categories.
                </div>
              </div>
            )}

            {/* Grid of Weak Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {weakAreas.map((area) => (
                <WeakAreaCard
                  key={area.category}
                  category={area.category}
                  avgScore={area.avgScore}
                  topics={area.topics}
                  onPractice={() => handlePractice(area.category)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
