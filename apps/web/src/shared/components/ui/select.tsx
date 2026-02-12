'use client';

import * as React from 'react';
import { cn } from '@lib/utils';

/**
 * Select nativo estilizado (sin dependencia de Radix).
 * Exporta también SelectContent, SelectTrigger, SelectValue, SelectItem
 * para compatibilidad con código que use la API tipo Radix.
 */

const selectStyles =
  'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200';

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(selectStyles, className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

/** Wrapper para el área del trigger; con uso compound el <select> se renderiza dentro. */
const SelectTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('relative flex h-10 w-full items-center', className)}
    {...props}
  >
    {children}
  </div>
));
SelectTrigger.displayName = 'SelectTrigger';

/** Muestra el valor seleccionado o placeholder. Uso: dentro de SelectTrigger. */
function SelectValue({
  placeholder,
  children,
}: {
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return <>{children ?? placeholder}</>;
}

/** Contenedor de las opciones; con select nativo sus hijos SelectItem se usan como <option>. */
const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn(className)} {...props}>
    {children}
  </div>
));
SelectContent.displayName = 'SelectContent';

/** Una opción; se renderiza como <option> cuando está dentro de un <select>. */
const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, children, ...props }, ref) => (
  <option ref={ref} className={cn(className)} {...props}>
    {children}
  </option>
));
SelectItem.displayName = 'SelectItem';

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
