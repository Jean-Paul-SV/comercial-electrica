import * as React from 'react';
import { Input, type InputProps } from './input';

type MoneyInputProps = Omit<
  InputProps,
  'type' | 'inputMode' | 'value' | 'onChange'
> & {
  /**
   * Valor numérico en la menor unidad (ej. pesos, sin decimales).
   * Usa null/undefined para "vacío".
   */
  value?: number | null;
  onChangeValue?: (value: number | null) => void;
  locale?: string;
};

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChangeValue, locale = 'es-CO', className, ...props }, ref) => {
    const formatted =
      value === null || value === undefined
        ? ''
        : new Intl.NumberFormat(locale, {
            maximumFractionDigits: 0,
          }).format(value);

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        className={className}
        value={formatted}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          const numeric = digits === '' ? null : Number(digits);
          onChangeValue?.(numeric);
        }}
        {...props}
      />
    );
  }
);

MoneyInput.displayName = 'MoneyInput';

