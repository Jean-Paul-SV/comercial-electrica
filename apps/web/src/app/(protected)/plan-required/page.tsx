'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, LayoutDashboard, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';

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
    'Para activar facturación electrónica (DIAN), cambia a un plan que la incluya (Básico con DIAN, Premium con DIAN o Enterprise). Luego deberás contratar nuestro servicio de configuración para poder emitir a la DIAN.',
};

export default function PlanRequiredPage() {
  const searchParams = useSearchParams();
  const moduleCode = searchParams.get('module') ?? '';
  const label = MODULE_LABELS[moduleCode] ?? (moduleCode || 'esta función');
  const upgradeHint = MODULE_UPGRADE_HINT[moduleCode];

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-5 w-5" />
            <CardTitle>Módulo no incluido en tu plan</CardTitle>
          </div>
          <CardDescription className="space-y-2">
            <span className="block">
              La sección &quot;{label}&quot; no está disponible con tu plan actual.
              Contacta a tu administrador o cambia de plan para acceder.
            </span>
            {upgradeHint && (
              <span className="block mt-2 text-foreground/90">{upgradeHint}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Button asChild className="w-full sm:w-auto" variant="default">
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
        </CardContent>
      </Card>
    </div>
  );
}
