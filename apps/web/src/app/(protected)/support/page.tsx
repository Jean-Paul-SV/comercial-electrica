'use client';

import { Button } from '@shared/components/ui/button';
import { MessageCircle, ArrowLeft } from 'lucide-react';
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
      <div className="space-y-10 mx-auto max-w-lg">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0 rounded-lg">
            <Link href="/app">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver al inicio</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <MessageCircle className="h-7 w-7 shrink-0 text-primary" aria-hidden />
              Soporte
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Abre WhatsApp en una nueva pestaña para contactar a soporte. La app seguirá abierta aquí.
            </p>
          </div>
        </header>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
          <div className="space-y-4">
            <Button asChild size="lg" className="w-full rounded-xl bg-[#25D366] hover:bg-[#20BD5A]">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 mx-auto max-w-lg">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 rounded-lg">
          <Link href="/app">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver al inicio</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <MessageCircle className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Soporte
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El número de WhatsApp de soporte no está configurado para esta instalación.
          </p>
        </div>
      </header>
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
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
      </div>
    </div>
  );
}
