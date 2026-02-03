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

const CHART_STROKE = '#e5e7eb';

export type KpiBarItem = {
  name: string;
  value: number;
  format?: 'number' | 'money';
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
      className={className ?? 'w-full overflow-visible'}
      style={{
        color: CHART_STROKE,
        minWidth: 280,
        width: '100%',
        height: 200,
        minHeight: 200,
      }}
    >
      <ResponsiveContainer width="100%" height={200} minWidth={280} minHeight={200}>
        <BarChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 36 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_STROKE} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : String(v))}
          />
          <Tooltip
            cursor={false}
            isAnimationActive={false}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
            }}
            formatter={(value: number | undefined, _name: string | undefined, props: { payload?: KpiBarItem }) => {
              const item = props.payload;
              const v = value ?? 0;
              if (item?.format === 'money') return formatMoney(v);
              return v;
            }}
          />
          <Bar dataKey="value" fill={barColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
