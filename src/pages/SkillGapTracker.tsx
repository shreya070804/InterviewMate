import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserFeedbackList } from '../firebase';
import { WeakAreaCard } from '../components/WeakAreaCard';
import type { Feedback } from '../types';

// Helper to compute average score per feedback entry
const computeAvg = (fb: Feedback) =>
  (fb.scores.correctness + fb.scores.efficiency + fb.scores.communication) / 3;

export const SkillGapTracker: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [weakAreas, setWeakAreas] = useState<
    { category: string; avgScore: number; topics: string[] }[]
  >([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const feedbackList = await getUserFeedbackList(user.uid);
        // Group scores by category (topic)
        const categoryMap: Record<string, { total: number; count: number }> = {};
        feedbackList.forEach((fb) => {
          const cat = fb.topic; // assumes topic matches the enum used in Session
          const avg = computeAvg(fb);
          if (!categoryMap[cat]) {
            categoryMap[cat] = { total: 0, count: 0 };
          }
          categoryMap[cat].total += avg;
          categoryMap[cat].count += 1;
        });
        const categoryAverages = Object.entries(categoryMap).map(([cat, data]) => ({
          category: cat,
          avgScore: data.total / data.count,
        }));
        // Sort ascending to get weakest categories
        const sorted = categoryAverages.sort((a, b) => a.avgScore - b.avgScore);
        const weakest = sorted.slice(0, 2);
        // Placeholder study topics – in real implementation this would come from Claude
        const placeholderTopics = [
          'Deep dive into fundamentals',
          'Practice advanced problems',
          'Review key concepts',
        ];
        const enriched = weakest.map((w) => ({
          category: w.category,
          avgScore: w.avgScore,
          topics: placeholderTopics,
        }));
        setWeakAreas(enriched);
      } catch (err) {
        console.error('Error loading skill gaps:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handlePractice = (category: string) => {
    navigate('/solo', { state: { prefillTopic: category } });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">
        Skill Gap Tracker
      </h1>
      {loading ? (
        <p className="text-slate-600 dark:text-slate-300">Loading…</p>
      ) : weakAreas.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-300">No sufficient feedback data to determine skill gaps.</p>
      ) : (
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
      )}
    </div>
  );
};
