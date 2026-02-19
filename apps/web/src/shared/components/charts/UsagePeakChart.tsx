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
import { formatDate } from '@shared/utils/format';

export type UsageByDayPoint = {
  date: string;
  count: number;
};

type UsagePeakChartProps = {
  data: UsageByDayPoint[];
  className?: string;
  title?: string;
};

const CHART_STROKE = 'hsl(var(--border) / 0.8)';

export function UsagePeakChart({ data, className, title }: UsagePeakChartProps) {
  if (!data.length) return null;

  return (
    <div className={className ?? 'h-72 w-full min-w-[280px] min-h-[200px]'} style={{ minHeight: 200, minWidth: 280 }}>
      {title ? <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p> : null}
      <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_STROKE} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            tickFormatter={(v) => formatDate(v).slice(0, 5)}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={false}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--background))',
            }}
            labelFormatter={(label) => formatDate(label)}
            formatter={(value: number | undefined) => [value ?? 0, 'Eventos']}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Eventos" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
