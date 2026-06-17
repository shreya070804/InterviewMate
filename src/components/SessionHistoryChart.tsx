import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface ChartDataItem {
  name: string;
  score: number;
}

interface SessionHistoryChartProps {
  data: ChartDataItem[];
}

export const SessionHistoryChart: React.FC<SessionHistoryChartProps> = React.memo(({ data }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Score Progression Over Time</h2>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
  );
});

SessionHistoryChart.displayName = 'SessionHistoryChart';
