'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { Textarea } from '@shared/components/ui/textarea';
import { Badge } from '@shared/components/ui/badge';
import { Lightbulb, Send, Loader2 } from 'lucide-react';
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
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-primary" />
          Sugerencias de mejora
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cuéntanos qué te gustaría mejorar en el software. Tus mensajes se revisan en el equipo de producto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enviar sugerencia</CardTitle>
          <CardDescription>
            Describe la mejora o idea. Máximo 2000 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis sugerencias enviadas</CardTitle>
          <CardDescription>
            Historial de las sugerencias que has enviado y su estado.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
