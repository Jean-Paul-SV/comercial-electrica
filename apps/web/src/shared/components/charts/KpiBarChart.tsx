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

export type KpiBarItem = {
  /** Etiqueta corta para el eje (evitar solapamiento). */
  name: string;
  value: number;
  format?: 'number' | 'money';
  /** Texto completo para el tooltip (ej. nombre completo del producto). */
  fullName?: string;
};

type KpiBarChartProps = {
  data: KpiBarItem[];
  className?: string;
  barColor?: string;
};

export function KpiBarChart({ data, className, barColor = 'hsl(var(--primary))' }: KpiBarChartProps) {
  if (!data.length) return null;

  return (
    <div
      className={className ?? 'w-full overflow-visible h-[200px] min-h-[200px]'}
      style={{ minWidth: 280, width: '100%' }}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={200}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 20, left: 8, bottom: 80 }}
          barCategoryGap={12}
          barSize={32}
        >
          <defs>
            <linearGradient id="kpi-bar-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={barColor} stopOpacity={0.95} />
              <stop offset="100%" stopColor={barColor} stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border) / 0.6)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{
              fontSize: 12,
              fill: 'hsl(var(--muted-foreground))',
              textAnchor: 'end',
            }}
            angle={-45}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border) / 0.8)' }}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border) / 0.8)' }}
            tickFormatter={(v) =>
              v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)
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
            labelFormatter={(_label, payload) => {
              const item = payload?.[0]?.payload as KpiBarItem | undefined;
              return item?.fullName ?? item?.name ?? '';
            }}
            formatter={(value: number | undefined, _name: string | undefined, props: { payload?: KpiBarItem }) => {
              const item = props.payload;
              const v = value ?? 0;
              if (item?.format === 'money') return formatMoney(v);
              return v;
            }}
          />
          <Bar
            dataKey="value"
            fill="url(#kpi-bar-fill)"
            radius={[6, 6, 0, 0]}
            animationDuration={400}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
