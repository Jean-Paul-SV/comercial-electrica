'use client';

import { AlertCircle } from 'lucide-react';
import { formatDianActivationCost } from '@shared/constants/dian-activation';

type Variant = 'inline' | 'card';

interface DianActivationDisclaimerProps {
  /** 'inline' = texto compacto; 'card' = recuadro destacado */
  variant?: Variant;
  className?: string;
}

/**
 * Aviso legal: el cliente debe hacerse cargo del certificado digital
 * y la activación en el software tiene un costo único aparte.
 */
export function DianActivationDisclaimer({
  variant = 'card',
  className = '',
}: DianActivationDisclaimerProps) {
  const costFormatted = formatDianActivationCost();

  const content = (
    <>
      <strong>Facturación electrónica (DIAN):</strong> el certificado digital (.p12) para firmar las facturas es responsabilidad del cliente (obtenerlo ante su contador o entidad certificadora). La activación en el software tiene un costo único de activación de {costFormatted} (aparte de la suscripción). Contáctanos para activarla.
    </>
  );

  if (variant === 'inline') {
    return (
      <p className={`text-sm text-muted-foreground ${className}`}>
        {content}
      </p>
    );
  }

  return (
    <div
      className={`flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground ${className}`}
      role="note"
      aria-label="Aviso sobre facturación electrónica"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" aria-hidden />
      <p className="leading-relaxed">
        {content}
      </p>
    </div>
  );
}
