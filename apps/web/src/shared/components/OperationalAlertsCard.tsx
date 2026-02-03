'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { OperationalAlert } from '@features/reports/types';

const severityBorderClass: Record<string, string> = {
  critical: 'border-l-destructive',
  high: 'border-l-warning',
  medium: 'border-l-primary',
  low: 'border-l-muted-foreground/40',
  info: 'border-l-muted-foreground/30',
};

type OperationalAlertsCardProps = {
  alerts: OperationalAlert[];
  title?: string;
  description?: string;
};

export function OperationalAlertsCard({
  alerts,
  title = 'Alertas operativas',
  description = 'Caja, inventario, cotizaciones, ventas y facturas proveedor',
}: OperationalAlertsCardProps) {
  if (alerts.length === 0) return null;

  const sorted = [...alerts].sort((a, b) => a.priority - b.priority);

  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground/80">{description}</p>
      <ul className="space-y-1.5">
        {sorted.map((alert) => (
          <li key={alert.code}>
            <Link
              href={alert.actionHref}
              className={`group flex rounded-md border-l-2 py-2 pr-2 pl-3 transition-colors hover:bg-muted/40 ${severityBorderClass[alert.severity] ?? severityBorderClass.info}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-medium text-foreground text-sm">{alert.title}</span>
                  {alert.count > 0 && (
                    <span className="text-xs text-muted-foreground">{alert.count}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                <span className="mt-1 inline-flex items-center gap-0.5 text-xs text-primary group-hover:underline">
                  {alert.actionLabel}
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
