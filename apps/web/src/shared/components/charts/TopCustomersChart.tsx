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
import { formatMoney } from '@shared/utils/format';

export type TopCustomerItem = {
  name: string;
  amount: number;
  sales: number;
};

type TopCustomersChartProps = {
  data: TopCustomerItem[];
  className?: string;
  maxBars?: number;
};

const CHART_STROKE = '#e5e7eb';

export function TopCustomersChart({ data, className, maxBars = 10 }: TopCustomersChartProps) {
  const slice = data.slice(0, maxBars);
  if (!slice.length) return null;

  return (
    <div className={className ?? 'h-72 w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={slice}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_STROKE} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            tickFormatter={(v) => (v.length > 14 ? v.slice(0, 12) + '…' : v)}
          />
          <Tooltip
            cursor={() => null}
            isAnimationActive={false}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
            }}
            formatter={(value: number) => [formatMoney(value), 'Monto']}
          />
          <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Monto" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
