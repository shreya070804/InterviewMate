import React from 'react';
import { Star } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avgScore: number;
  sessionsCompleted: number;
}

interface LeaderboardTableProps {
  board: LeaderboardEntry[];
  currentUserUid?: string;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = React.memo(({ board, currentUserUid }) => {
  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-xl">🥇</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    return <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">#{rank}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <th className="px-6 py-4">Rank</th>
            <th className="px-6 py-4">User</th>
            <th className="px-6 py-4 text-center">Sessions Done</th>
            <th className="px-6 py-4 text-right">Avg Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {board.map((player) => {
            const isCurrentUser = currentUserUid && player.userId === currentUserUid;
            return (
              <tr 
                key={player.userId}
                className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-850/50 ${
                  isCurrentUser 
                    ? 'bg-teal-50/40 dark:bg-teal-950/20 border-l-4 border-l-brand font-semibold' 
                    : ''
                }`}
              >
                <td className="whitespace-nowrap px-6 py-4.5">
                  <div className="flex items-center gap-2">
                    {getRankBadge(player.rank)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4.5">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${player.userId}`}
                      alt={`${player.displayName}'s profile avatar`}
                      loading="lazy"
                      decoding="async"
                      className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                    />
                    <div>
                      <span className="text-slate-900 dark:text-white font-medium flex items-center gap-1.5">
                        {player.displayName}
                        {isCurrentUser && (
                          <span className="text-[9px] uppercase bg-brand text-white font-bold px-1.5 py-0.5 rounded tracking-wider">
                            You
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4.5 text-center text-slate-600 dark:text-slate-350">
                  {player.sessionsCompleted}
                </td>
                <td className="whitespace-nowrap px-6 py-4.5 text-right font-mono font-bold">
                  <span className={`inline-flex items-center gap-1 text-sm ${
                    player.avgScore >= 8.0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : player.avgScore >= 5.0 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-slate-500'
                  }`}>
                    <Star className="h-3.5 w-3.5 fill-current shrink-0" />
                    {player.avgScore.toFixed(1)}/10
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

LeaderboardTable.displayName = 'LeaderboardTable';
