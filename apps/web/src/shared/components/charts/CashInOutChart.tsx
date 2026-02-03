'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatMoney } from '@shared/utils/format';

export type CashInOutItem = {
  name: string;
  entradas: number;
  salidas: number;
  ajustes?: number;
};

type CashInOutChartProps = {
  data: CashInOutItem[];
  className?: string;
};

const CHART_STROKE = '#e5e7eb';

export function CashInOutChart({ data, className }: CashInOutChartProps) {
  if (!data.length) return null;

  return (
    <div className={className ?? 'h-64 w-full min-w-[280px] min-h-[200px]'} style={{ minHeight: 200, minWidth: 280 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_STROKE} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: CHART_STROKE }}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            cursor={false}
            isAnimationActive={false}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
            }}
            formatter={(value: number | undefined) => formatMoney(value ?? 0)}
          />
          <Legend />
          <Bar dataKey="entradas" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} name="Entradas" />
          <Bar dataKey="salidas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Salidas" />
          {(data.some((d) => (d.ajustes ?? 0) > 0)) && (
            <Bar dataKey="ajustes" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} name="Ajustes" />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
