/**
 * Indicadores accionables: insight + acción sugerida + enlace.
 * Ver docs/INDICADORES_Y_ACCIONES.md
 */
export interface ActionableIndicatorItem {
  id: string;
  name: string;
  value?: number | string;
  /** Precio mínimo sugerido para alcanzar margen objetivo (ej. 15 %). Solo en productos con pérdida o margen bajo. */
  suggestedPrice?: number;
  /** Total en ventas (numérico). Solo en indicador SALES_BY_EMPLOYEE para gráficos. */
  totalSales?: number;
  /** Stock (unidades en mano). Solo en indicador PRODUCTS_NO_ROTATION. */
  stock?: number;
}

export interface ActionableIndicator {
  code: string;
  title: string;
  insight: string;
  metric: string | number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  suggestedAction: string;
  actionLabel: string;
  actionHref: string;
  items: ActionableIndicatorItem[];
  detectedAt: string;
}

export interface ActionableIndicatorsResponse {
  periodDays: number;
  indicators: ActionableIndicator[];
}
