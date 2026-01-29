'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Wallet } from 'lucide-react';

export default function CashPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Caja</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Sesiones de caja
          </CardTitle>
          <CardDescription>
            Abrir/cerrar sesión y movimientos. Próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Conectar con endpoints: GET/POST /cash/sessions, POST /cash/sessions/:id/close
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
