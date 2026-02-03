/**
 * Presets de color para la interfaz.
 * Valores en HSL (H S% L%) para --primary y --ring.
 * Colores armónicos y profesionales para Comercial Eléctrica.
 */

export type ThemeId =
  | 'blue'
  | 'indigo'
  | 'emerald'
  | 'violet'
  | 'amber'
  | 'slate';

export type ThemeVariant = {
  primary: string;
  primaryForeground: string;
  ring: string;
};

export type ThemePreset = {
  id: ThemeId;
  name: string;
  /** Color de muestra para el selector (hex o nombre). */
  swatch: string;
  light: ThemeVariant;
  dark: ThemeVariant;
};

/** Azul corporativo (por defecto). */
const blue: ThemePreset = {
  id: 'blue',
  name: 'Azul',
  swatch: '#2563EB',
  light: {
    primary: '221 83% 53%',
    primaryForeground: '0 0% 100%',
    ring: '221 83% 53%',
  },
  dark: {
    primary: '221 83% 58%',
    primaryForeground: '0 0% 100%',
    ring: '221 83% 58%',
  },
};

/** Índigo, más suave que el azul. */
const indigo: ThemePreset = {
  id: 'indigo',
  name: 'Índigo',
  swatch: '#4F46E5',
  light: {
    primary: '239 84% 67%',
    primaryForeground: '0 0% 100%',
    ring: '239 84% 67%',
  },
  dark: {
    primary: '239 84% 72%',
    primaryForeground: '0 0% 100%',
    ring: '239 84% 72%',
  },
};

/** Verde esmeralda, profesional. */
const emerald: ThemePreset = {
  id: 'emerald',
  name: 'Esmeralda',
  swatch: '#059669',
  light: {
    primary: '160 84% 39%',
    primaryForeground: '0 0% 100%',
    ring: '160 84% 39%',
  },
  dark: {
    primary: '160 84% 45%',
    primaryForeground: '0 0% 100%',
    ring: '160 84% 45%',
  },
};

/** Violeta. */
const violet: ThemePreset = {
  id: 'violet',
  name: 'Violeta',
  swatch: '#7C3AED',
  light: {
    primary: '263 70% 50%',
    primaryForeground: '0 0% 100%',
    ring: '263 70% 50%',
  },
  dark: {
    primary: '263 70% 58%',
    primaryForeground: '0 0% 100%',
    ring: '263 70% 58%',
  },
};

/** Ámbar, cálido. */
const amber: ThemePreset = {
  id: 'amber',
  name: 'Ámbar',
  swatch: '#D97706',
  light: {
    primary: '32 95% 44%',
    primaryForeground: '0 0% 100%',
    ring: '32 95% 44%',
  },
  dark: {
    primary: '38 92% 50%',
    primaryForeground: '32 95% 15%',
    ring: '38 92% 50%',
  },
};

/** Slate / gris azulado, neutro. */
const slate: ThemePreset = {
  id: 'slate',
  name: 'Slate',
  swatch: '#475569',
  light: {
    primary: '215 28% 35%',
    primaryForeground: '0 0% 100%',
    ring: '215 28% 35%',
  },
  dark: {
    primary: '215 20% 55%',
    primaryForeground: '215 28% 12%',
    ring: '215 20% 55%',
  },
};

export const THEME_PRESETS: ThemePreset[] = [
  blue,
  indigo,
  emerald,
  violet,
  amber,
  slate,
];

export const THEME_MAP: Record<ThemeId, ThemePreset> = {
  blue,
  indigo,
  emerald,
  violet,
  amber,
  slate,
};

export const DEFAULT_THEME_ID: ThemeId = 'blue';
