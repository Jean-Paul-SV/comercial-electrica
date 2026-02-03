'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useOfflineQueue } from '@shared/offline-queue/useOfflineQueue';
import { cn } from '@lib/utils';

function pathToLabel(path: string, method: string): string {
  if (path.includes('/sales') && method === 'POST') return 'Venta';
  if (path.includes('/cash') && path.includes('sessions')) return 'Caja';
  if (path.includes('/expenses') && method === 'POST') return 'Gasto';
  if (path.includes('/inventory') && path.includes('movements')) return 'Mov. inventario';
  if (path.includes('/quotes') && method === 'POST') return 'Cotización';
  if (path.includes('/customers') && method === 'POST') return 'Cliente';
  const segment = path.replace(/^\//, '').split('/')[0] ?? path;
  return `${method} ${segment}`;
}

export function OfflineQueueBell() {
  const { pending, pendingCount, processQueue, remove } = useOfflineQueue();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onOutside);
    return () => document.removeEventListener('click', onOutside);
  }, [open]);

  if (pendingCount === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${pendingCount} pendiente(s) de enviar`}
      >
        <Send className="h-5 w-5 text-muted-foreground" />
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-medium text-white'
          )}
        >
          {pendingCount}
        </span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card p-2 shadow-lg">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Pendientes de enviar
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Se enviarán al recuperar la conexión o al hacer clic en Reintentar.
          </p>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {pending.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/30 px-2 py-1.5 text-xs"
              >
                <span className="truncate">
                  {item.label ?? pathToLabel(item.path, item.method)}
                </span>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      void processQueue();
                      setOpen(false);
                    }}
                    aria-label="Reintentar"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => remove(item.id)}
                    aria-label="Quitar de la cola"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              void processQueue();
              setOpen(false);
            }}
          >
            Reintentar todo
          </Button>
        </div>
      )}
    </div>
  );
}
