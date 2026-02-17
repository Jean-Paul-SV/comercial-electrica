'use client';

import { useEffect, useState } from 'react';
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
  const [redirected, setRedirected] = useState(false);
  const number = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER ?? '';
  const defaultMessage = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_MESSAGE ?? DEFAULT_MESSAGE;

  useEffect(() => {
    if (!number.trim() || redirected) return;
    const cleanNumber = number.replace(/\D/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(defaultMessage)}`;
    setRedirected(true);
    window.location.href = url;
  }, [number, defaultMessage, redirected]);

  if (number.trim()) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Redirigiendo a WhatsApp…</p>
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
            Si eres el administrador, configura la variable de entorno{' '}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER</code> en el
            frontend (formato internacional sin +, por ejemplo 573001234567).
          </p>
          <Button asChild variant="secondary">
            <Link href="/app">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
