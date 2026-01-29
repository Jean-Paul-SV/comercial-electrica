'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Package } from 'lucide-react';

export default function ProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Productos</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catálogo de productos
          </CardTitle>
          <CardDescription>
            Listado, creación y edición de productos y categorías. Próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Conectar con endpoints: GET/POST /products, GET/POST /categories
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
