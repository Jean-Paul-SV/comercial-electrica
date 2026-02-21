'use client';

import { useState } from 'react';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { Textarea } from '@shared/components/ui/textarea';
import { Badge } from '@shared/components/ui/badge';
import Link from 'next/link';
import { Lightbulb, Send, Loader2, ArrowLeft } from 'lucide-react';
import { useMyFeedback, useSubmitFeedback } from '@features/feedback/hooks';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  READ: 'Leída',
  DONE: 'Resuelta',
};

export default function FeedbackPage() {
  const [message, setMessage] = useState('');
  const { data: myFeedback = [], isLoading } = useMyFeedback();
  const submit = useSubmitFeedback();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error('Escribe tu sugerencia.');
      return;
    }
    submit.mutate(trimmed, {
      onSuccess: () => {
        setMessage('');
        toast.success('Sugerencia enviada. La revisaremos pronto.');
      },
      onError: (err: unknown) => {
        const msg = (err as { message?: string })?.message ?? 'Error al enviar.';
        toast.error(msg);
      },
    });
  };

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 rounded-lg">
          <Link href="/app">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver al inicio</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Lightbulb className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            Sugerencias de mejora
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuéntanos qué te gustaría mejorar en el software. Tus mensajes se revisan en el equipo de producto.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
        <h2 className="text-base font-medium text-foreground mb-1">Enviar sugerencia</h2>
        <p className="text-sm text-muted-foreground mb-4">Describe la mejora o idea. Máximo 2000 caracteres.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Mensaje</Label>
              <Textarea
                id="feedback-message"
                placeholder="Ej: Sería útil poder exportar el listado de clientes a Excel."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={4}
                className="resize-none"
                disabled={submit.isPending}
              />
              <p className="text-xs text-muted-foreground">
                {message.length} / 2000
              </p>
            </div>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar sugerencia
            </Button>
          </form>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] p-6 dark:border-[#1F2937]">
        <h2 className="text-base font-medium text-foreground mb-1">Mis sugerencias enviadas</h2>
        <p className="text-sm text-muted-foreground mb-4">Historial de las sugerencias que has enviado y su estado.</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : myFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has enviado ninguna sugerencia.
            </p>
          ) : (
            <ul className="space-y-4">
              {myFeedback.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2"
                >
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {item.message}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString('es-CO')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
