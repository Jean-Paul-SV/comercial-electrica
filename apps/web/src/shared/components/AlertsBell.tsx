'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { useOperationalState } from '@features/reports/hooks';
import type { OperationalAlert } from '@features/reports/types';
import { cn } from '@lib/utils';

const severityBorderClass: Record<string, string> = {
  critical: 'border-l-destructive',
  high: 'border-l-warning',
  medium: 'border-l-primary',
  low: 'border-l-muted-foreground/40',
  info: 'border-l-muted-foreground/30',
};

export function AlertsBell() {
  const { data, isLoading } = useOperationalState();
  const alerts: OperationalAlert[] = data?.alerts ?? [];
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const sorted = [...alerts].sort((a, b) => a.priority - b.priority);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      right: typeof window !== 'undefined' ? window.innerWidth - rect.right : 0,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onEscape);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const panel = open && typeof document !== 'undefined' && (
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[min(90vw,360px)] rounded-lg border border-border bg-popover shadow-lg"
      style={
        position
          ? { top: position.top, right: position.right, left: 'auto' }
          : { top: 0, right: 0, left: 'auto' }
      }
      role="dialog"
      aria-label="Alertas operativas"
    >
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium text-foreground">Alertas operativas</h2>
        <p className="text-xs text-muted-foreground">Caja, inventario, cotizaciones, ventas</p>
      </div>
      <div className="max-h-[min(70vh,400px)] overflow-y-auto overflow-x-hidden p-2">
        {sorted.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin alertas</p>
        ) : (
          <ul className="space-y-1">
            {sorted.map((alert) => (
              <li key={alert.code}>
                <Link
                  href={alert.actionHref}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex rounded-md border-l-2 py-2 pr-2 pl-3 transition-colors hover:bg-muted/50',
                    severityBorderClass[alert.severity] ?? severityBorderClass.info
                  )}
                >
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-medium text-foreground text-sm break-words">
                        {alert.title}
                      </span>
                      {alert.count > 0 && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          ({alert.count})
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground break-words">
                      {alert.message}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-0.5 text-xs text-primary break-words">
                      {alert.actionLabel}
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={alerts.length > 0 ? `${alerts.length} alertas` : 'Alertas'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {!isLoading && alerts.length > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
            aria-hidden
          >
            {alerts.length > 99 ? '99+' : alerts.length}
          </span>
        )}
      </button>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
