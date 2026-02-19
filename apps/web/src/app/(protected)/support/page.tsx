'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { MessageCircle } from 'lucide-react';
import Link from 'next/link';

const DEFAULT_MESSAGE = 'Hola, necesito ayuda con Orion.';

export default function SupportPage() {
  const number = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER ?? '';
  const defaultMessage = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_MESSAGE ?? DEFAULT_MESSAGE;
  const cleanNumber = number.replace(/\D/g, '');
  const whatsappUrl =
    number.trim() &&
    `https://wa.me/${cleanNumber}?text=${encodeURIComponent(defaultMessage)}`;

  if (whatsappUrl) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Soporte
            </CardTitle>
            <CardDescription>
              Abre WhatsApp en una nueva pestaña para contactar a soporte. La app seguirá abierta aquí.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild size="lg" className="w-full bg-[#25D366] hover:bg-[#20BD5A]">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir WhatsApp en nueva pestaña"
              >
                Abrir WhatsApp
              </a>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/app">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Soporte
          </CardTitle>
          <CardDescription>
            El número de WhatsApp de soporte no está configurado para esta instalación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm mb-4">
            Si eres el administrador, configura la variable{' '}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER</code> en el
            <strong> frontend</strong>, no en la API:
          </p>
          <ul className="text-muted-foreground text-sm mb-4 list-disc list-inside space-y-1">
            <li><strong>Local:</strong> en <code className="rounded bg-muted px-1">apps/web/.env.local</code> y reinicia el servidor web (<code className="rounded bg-muted px-1">npm run dev:web</code>).</li>
            <li><strong>Producción (Vercel, etc.):</strong> en Variables de entorno del <strong>proyecto web</strong>, no del proyecto API.</li>
          </ul>
          <p className="text-muted-foreground text-sm mb-4">
            Formato del número: internacional sin + (ej. 573045983093).
          </p>
          <Button asChild variant="secondary">
            <Link href="/app">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
