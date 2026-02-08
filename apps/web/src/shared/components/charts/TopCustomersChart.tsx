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

const MAX_NAME_LENGTH = 36;

export function TopCustomersChart({ data, className, maxBars = 10 }: TopCustomersChartProps) {
  const slice = data.slice(0, maxBars);
  if (!slice.length) return null;

  return (
    <div
      className={className ?? 'h-72 w-full min-w-[280px] min-h-[240px]'}
      style={{ minHeight: 240, minWidth: 320 }}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={240}>
        <BarChart
          data={slice}
          layout="vertical"
          margin={{ top: 12, right: 20, left: 8, bottom: 12 }}
          barSize={22}
          barCategoryGap={10}
        >
          <defs>
            <linearGradient id="top-customers-bar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border) / 0.6)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border) / 0.8)' }}
            tickFormatter={(v) =>
              v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            width={220}
            tick={{
              fontSize: 13,
              fill: 'hsl(var(--foreground) / 0.95)',
              fontWeight: 500,
            }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border) / 0.8)' }}
            tickFormatter={(v) =>
              typeof v === 'string' && v.length > MAX_NAME_LENGTH
                ? v.slice(0, MAX_NAME_LENGTH - 1) + '…'
                : v
            }
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
            isAnimationActive={false}
            contentStyle={{
              borderRadius: 'var(--radius)',
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
              boxShadow: '0 4px 12px hsl(var(--foreground) / 0.08)',
              padding: '10px 14px',
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}
            formatter={(value: number | undefined) => [formatMoney(value ?? 0), 'Monto']}
          />
          <Bar
            dataKey="amount"
            fill="url(#top-customers-bar)"
            radius={[0, 6, 6, 0]}
            name="Monto"
            animationDuration={400}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
