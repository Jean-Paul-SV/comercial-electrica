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

export function CashInOutChart({ data, className }: CashInOutChartProps) {
  if (!data.length) return null;

  return (
    <div
      className={className ?? 'h-64 w-full min-w-[280px] min-h-[200px]'}
      style={{ minHeight: 200, minWidth: 280 }}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={200}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 16, left: 8, bottom: 24 }}
          barCategoryGap="24%"
          barGap={12}
        >
          <defs>
            <linearGradient id="cash-entradas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.75} />
            </linearGradient>
            <linearGradient id="cash-salidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.95} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="cash-ajustes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={1} />
              <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border) / 0.6)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border) / 0.8)' }}
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
            cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
            isAnimationActive={false}
            contentStyle={{
              borderRadius: 'var(--radius)',
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
              boxShadow: '0 4px 12px hsl(var(--foreground) / 0.08)',
              padding: '10px 14px',
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number | undefined) => [formatMoney(value ?? 0), null]}
          />
          <Legend
            wrapperStyle={{ paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
          />
          <Bar
            dataKey="entradas"
            fill="url(#cash-entradas)"
            radius={[6, 6, 0, 0]}
            name="Entradas"
            maxBarSize={72}
            animationDuration={400}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="salidas"
            fill="url(#cash-salidas)"
            radius={[6, 6, 0, 0]}
            name="Salidas"
            maxBarSize={72}
            animationDuration={400}
            animationEasing="ease-out"
          />
          {(data.some((d) => (d.ajustes ?? 0) > 0)) && (
            <Bar
              dataKey="ajustes"
              fill="url(#cash-ajustes)"
              radius={[6, 6, 0, 0]}
              name="Ajustes"
              maxBarSize={72}
              animationDuration={400}
              animationEasing="ease-out"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
