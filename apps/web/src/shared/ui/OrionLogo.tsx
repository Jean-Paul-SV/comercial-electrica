'use client';

import { useId } from 'react';
import { cn } from '@lib/utils';

type OrionLogoProps = {
  /** Tamaño del icono (lado del cuadrado). */
  size?: number;
  /** Incluir círculo de fondo (estilo favicon). */
  withCircle?: boolean;
  className?: string;
  'aria-label'?: string;
};

/**
 * Logo de Orion: constelación de estrellas (mismo diseño que el favicon).
 * Usar en sidebar, login y cabeceras en lugar del icono genérico.
 */
export function OrionLogo({
  size = 32,
  withCircle = false,
  className,
  'aria-label': ariaLabel = 'Orion',
}: OrionLogoProps) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={cn('shrink-0', className)}
    >
      {withCircle && (
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary, #3b82f6)" stopOpacity={0.15} />
            <stop offset="100%" stopColor="var(--primary, #3b82f6)" stopOpacity={0} />
          </radialGradient>
        </defs>
      )}
      {withCircle && (
        <circle
          cx="16"
          cy="16"
          r="16"
          fill={`url(#${gradientId})`}
          className="dark:opacity-90"
        />
      )}
      {/* Estrellas de la constelación Orion */}
      <g fill="currentColor" className="text-primary">
        <path d="M16 11.2 17 13.8 19.6 14.8 17 15.8 16 18.4 15 15.8 12.4 14.8 15 13.8z" />
        <path d="M21 7.5 21.7 9.2 23.4 9.9 21.7 10.6 21 12.3 20.3 10.6 18.6 9.9 20.3 9.2z" />
        <path d="M10 18.5 10.7 20.2 12.4 20.9 10.7 21.6 10 23.3 9.3 21.6 7.6 20.9 9.3 20.2z" />
      </g>
    </svg>
  );
}
