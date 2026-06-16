import React from 'react';
import { ArrowRight } from 'lucide-react';

type WeakAreaCardProps = {
  category: string;
  avgScore: number;
  topics: string[];
  onPractice: () => void;
};

export const WeakAreaCard: React.FC<WeakAreaCardProps> = ({ category, avgScore, topics, onPractice }) => {
  const progressColor = avgScore < 5 ? 'bg-red-500' : avgScore < 7 ? 'bg-amber-400' : 'bg-green-500';
  const widthPercent = Math.min(100, (avgScore / 10) * 100);
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">{category}</h3>
      <div className="mb-2">
        <div className="h-2 w-full bg-slate-200 rounded overflow-hidden">
          <div
            className={`h-full ${progressColor} rounded`}
            style={{ width: `${widthPercent}%` }}
          />
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Avg. Score: {avgScore.toFixed(1)}/10
        </p>
      </div>
      <ul className="list-disc list-inside mb-4 space-y-1 text-slate-700 dark:text-slate-300">
        {topics.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <button
        onClick={onPractice}
        className="inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand-hover text-white px-4 py-2 text-sm font-semibold"
      >
        Practice this now <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
