'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatMoney, formatDate } from '@shared/utils/format';

export type SaleByDayItem = {
  date: string;
  total: number;
  count: number;
};

type SalesByDayChartProps = {
  data: SaleByDayItem[];
  className?: string;
};

const CHART_STROKE = '#e5e7eb';

export function SalesByDayChart({ data, className }: SalesByDayChartProps) {
  if (!data.length) return null;

  return (
    <div className={className ?? 'h-72 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_STROKE} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            tickFormatter={(v) => formatDate(v).slice(0, 5)}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            cursor={() => null}
            isAnimationActive={false}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
            }}
            labelFormatter={(label) => formatDate(label)}
            formatter={(value: number) => [formatMoney(value), 'Total']}
          />
          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
