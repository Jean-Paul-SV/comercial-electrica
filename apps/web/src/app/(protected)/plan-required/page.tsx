'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, LayoutDashboard, CreditCard } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { DianActivationDisclaimer } from '@shared/components/DianActivationDisclaimer';

const MODULE_LABELS: Record<string, string> = {
  inventory: 'Inventario',
  suppliers: 'Compras y proveedores',
  electronic_invoicing: 'Facturación electrónica (DIAN)',
  advanced_reports: 'Reportes avanzados',
  audit: 'Auditoría',
  backups: 'Backups y exportación',
};

/** Mensaje extra cuando el módulo es DIAN: cómo activarlo. */
const MODULE_UPGRADE_HINT: Record<string, string> = {
  electronic_invoicing:
    'Cambia a un plan que incluya facturación electrónica (Básico con DIAN, Premium con DIAN o Enterprise).',
};

export default function PlanRequiredPage() {
  const searchParams = useSearchParams();
  const moduleCode = searchParams.get('module') ?? '';
  const label = MODULE_LABELS[moduleCode] ?? (moduleCode || 'esta función');
  const upgradeHint = MODULE_UPGRADE_HINT[moduleCode];

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center justify-center gap-2">
            <Lock className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            M?dulo no incluido en tu plan
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La secci?n &quot;{label}&quot; no est? disponible con tu plan actual.
            Contacta a tu administrador o cambia de plan para acceder.
          </p>
          {upgradeHint && (
            <p className="mt-2 text-sm text-foreground/90">{upgradeHint}</p>
          )}
          {moduleCode === 'electronic_invoicing' && (
            <div className="mt-3 text-left">
              <DianActivationDisclaimer variant="card" />
            </div>
          )}
        </header>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937] flex flex-col sm:flex-row gap-2">
          <Button asChild className="w-full sm:w-auto rounded-xl bg-primary hover:bg-primary/90" variant="default">
            <Link href="/settings/billing">
              <CreditCard className="mr-2 h-4 w-4" />
              Cambiar de plan
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto" variant="outline">
            <Link href="/app">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Volver al inicio
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
