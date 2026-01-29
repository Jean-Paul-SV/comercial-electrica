'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { FileText } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Reportes</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reportes y dashboard
          </CardTitle>
          <CardDescription>
            Ventas, inventario, caja y clientes. Próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Conectar con endpoints: GET /reports/*
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
