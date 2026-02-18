/**
 * Costo único de activación de facturación electrónica en el software (COP).
 * El cliente además debe obtener su propio certificado digital (.p12) ante su contador o entidad certificadora.
 */
export const DIAN_ACTIVATION_COST_COP = 300_000;

export function formatDianActivationCost(): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(DIAN_ACTIVATION_COST_COP);
}
