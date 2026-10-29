import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';
import { BarChart3 } from 'lucide-react';

export function DetourComparisonChart({ recommendations = [], onSelectRestaurant }) {
  if (!recommendations || recommendations.length === 0) return null;

  const chartData = recommendations.map(rec => ({
    id: rec.restaurant.id,
    name: rec.restaurant.name.length > 16 ? rec.restaurant.name.substring(0, 14) + '...' : rec.restaurant.name,
    fullName: rec.restaurant.name,
    score: rec.finalScore,
    detourMinutes: parseFloat((rec.detourMetrics.detourDurationSeconds / 60).toFixed(1)),
    accessClass: rec.restaurant.accessClass,
    rank: rec.rank
  }));

  const getBarColor = (accessClass, rank) => {
    if (rank === 1) return '#B8F34A'; // Accent highlight for #1
    if (accessClass === 'GREEN') return '#35D07F';
    if (accessClass === 'YELLOW') return '#FFB84D';
    if (accessClass === 'RED') return '#FF5D67';
    return '#94A3B8';
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-secondary/95 border border-borderStrong p-3 rounded-xl shadow-2xl text-xs space-y-1">
          <div className="font-bold text-textMain flex items-center gap-1.5">
            <span>#{data.rank}</span>
            <span>{data.fullName}</span>
          </div>
          <div className="text-accent font-mono font-bold">Convenience Score: {data.score}/100</div>
          <div className="text-muted font-mono">Detour Added: +{data.detourMinutes} min</div>
          <div className="text-[11px] font-mono">
            Access: <span className="font-bold text-textMain">{data.accessClass}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card/90 backdrop-blur-md rounded-2xl border border-borderSubtle p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between border-b border-borderSubtle pb-2.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-bold text-textMain">Detour & Convenience Score Comparison</h3>
        </div>
        <span className="text-[10px] text-muted font-mono">
          Task 2 & Multi-Factor Efficiency Ranking
        </span>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#223048" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#94A3B8"
              fontSize={10}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
            />
            <YAxis
              stroke="#94A3B8"
              fontSize={10}
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="score"
              radius={[6, 6, 0, 0]}
              onClick={(data) => onSelectRestaurant(data.id)}
              className="cursor-pointer"
            >
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.id}`} fill={getBarColor(entry.accessClass, entry.rank)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted font-mono pt-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent"></span> Top Rank (#1)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success"></span> GREEN Access
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-warning"></span> YELLOW Access
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-danger"></span> RED Access
          </span>
        </div>
        <span>Click bar to inspect restaurant</span>
      </div>
    </div>
  );
}
