'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDianConfigStatus } from '@features/dian/hooks';
import { AlertTriangle } from 'lucide-react';

/** Banner in-app: certificado por vencer o rango bajo. Solo cuando el tenant tiene facturación electrónica lista. */
export function DianAlertsBanner() {
  const pathname = usePathname();
  const { data: status, isLoading } = useDianConfigStatus();

  if (isLoading || !status) return null;
  if (!status.readyForSend) return null;

  const certWarn = status.certExpiresInDays != null && status.certExpiresInDays < 30;
  const rangeWarn = status.rangeRemaining != null && status.rangeRemaining < 500;
  if (!certWarn && !rangeWarn) return null;

  const isOnConfigPage = pathname?.includes('/settings/electronic-invoicing');
  if (isOnConfigPage) return null;

  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
      <div className="min-w-0 flex-1">
        {certWarn && (
          <p>
            Su certificado de firma electrónica vence en{' '}
            <strong>{status.certExpiresInDays} día{status.certExpiresInDays !== 1 ? 's' : ''}</strong>.
            Renuévelo a tiempo para no interrumpir el envío a la DIAN.
          </p>
        )}
        {rangeWarn && (
          <p className={certWarn ? 'mt-1' : ''}>
            Quedan <strong>{status.rangeRemaining}</strong> números en su rango autorizado.
            Solicite un nuevo rango a la DIAN si es necesario.
          </p>
        )}
      </div>
      <Link
        href="/settings/electronic-invoicing"
        className="shrink-0 font-medium text-amber-800 dark:text-amber-200 underline hover:no-underline"
      >
        Configurar
      </Link>
    </div>
  );
}
