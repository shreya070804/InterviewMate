import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { getWeeklyLeaderboardPaginated, optInToLeaderboard } from '../firebase';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { Trophy, ShieldAlert, Award } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avgScore: number;
  sessionsCompleted: number;
}

export const Leaderboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [submittingOptIn, setSubmittingOptIn] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (profile) {
      setIsOptedIn(!!profile.optedInLeaderboard);
    }
  }, [profile]);

  const loadLeaderboardData = async (isFirstLoad = false) => {
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const currentLastDoc = isFirstLoad ? null : lastDoc;
      const res = await getWeeklyLeaderboardPaginated(currentLastDoc, 10);
      setBoard(prev => isFirstLoad ? res.items : [...prev, ...res.items]);
      setLastDoc(res.lastVisible);
      setHasMore(res.hasMore);
    } catch (e) {
      console.error("Failed to load leaderboard:", e);
    } finally {
      if (isFirstLoad) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    loadLeaderboardData(true);
  }, []);

  const handleOptInToggle = async () => {
    if (!user || !profile) return;
    setSubmittingOptIn(true);
    try {
      const nextOptIn = !isOptedIn;
      await optInToLeaderboard(
        user.uid, 
        nextOptIn, 
        profile.displayName || user.displayName || 'Developer'
      );
      setIsOptedIn(nextOptIn);
      // Reload rankings from start
      await loadLeaderboardData(true);
    } catch (err) {
      console.error(err);
      alert("Failed to update leaderboard settings");
    } finally {
      setSubmittingOptIn(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 transition-colors duration-200">
        
        {/* Banner Headers */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500 animate-bounce" /> Peer Leaderboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Top performing peers ranked by average mock interview scores over the past 7 days. Updated weekly.
            </p>
          </div>
          
          {/* Settings Toggle Card */}
          {user && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex items-center gap-4 shrink-0">
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Public Profile</p>
                <p className="text-[10px] text-slate-400">Show me on the leaderboard</p>
              </div>
              <button
                onClick={handleOptInToggle}
                disabled={submittingOptIn}
                role="switch"
                aria-checked={isOptedIn}
                aria-label="Toggle public visibility on leaderboard"
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                  isOptedIn ? 'bg-brand' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isOptedIn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* Opt-In Alert Banner */}
        {!isOptedIn && !loading && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-yellow-200 dark:border-yellow-900/30 bg-yellow-50/70 dark:bg-yellow-950/20 p-4 text-slate-800 dark:text-slate-200">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-xs font-bold">You're not visible on the leaderboard</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Other users can't see your profile or progress. Enable opt-in above to showcase your mock performance.
                </p>
              </div>
            </div>
            <button
              onClick={handleOptInToggle}
              disabled={submittingOptIn}
              className="rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold py-2 px-4 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              Opt In Now
            </button>
          </div>
        )}

        {/* Leaderboard Table Container */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
            </div>
          ) : board.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400">
              <Award className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-semibold">No participants listed yet</p>
              <p className="text-xs mt-1">Mock sessions completed this week will calculate ranks automatically.</p>
            </div>
          ) : (
            <>
              <LeaderboardTable board={board} currentUserUid={user?.uid} />
              
              {hasMore && (
                <div className="flex justify-center py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <button
                    onClick={() => loadLeaderboardData(false)}
                    disabled={loadingMore}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-2 px-5 text-xs transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Small Tips Footer */}
        <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-5 text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Award className="h-4 w-4 text-brand" /> Leaderboard Rules & Guidelines
          </h4>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <li>Calculated weekly on Monday at 00:00 UTC based on feedback score sheets.</li>
            <li>Requires at least 1 finished peer or AI practice session in the past 7 days to rank.</li>
            <li>Score metric weights Correctness, Efficiency, and Communication scores equally.</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};
