'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, LayoutDashboard } from 'lucide-react';
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

export default function PlanRequiredPage() {
  const searchParams = useSearchParams();
  const moduleCode = searchParams.get('module') ?? '';
  const label = MODULE_LABELS[moduleCode] ?? (moduleCode || 'esta función');

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-5 w-5" />
            <CardTitle>Módulo no incluido en tu plan</CardTitle>
          </div>
          <CardDescription>
            La sección &quot;{label}&quot; no está disponible con tu plan actual.
            Contacta a tu administrador o mejora tu plan para acceder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full sm:w-auto" variant="default">
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
