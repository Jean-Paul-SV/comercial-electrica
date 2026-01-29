'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Users } from 'lucide-react';

export default function CustomersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Clientes</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestión de clientes
          </CardTitle>
          <CardDescription>
            CRUD de clientes. Próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Conectar con endpoints: GET/POST/PATCH /customers
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
