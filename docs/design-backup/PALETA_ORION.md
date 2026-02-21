# Paleta de colores Orion (Comercial Eléctrica)

Referencia de la paleta actual del proyecto: identidad **Orion** (Rigel/Betelgeuse), dark mode fintech, azul eléctrico como primario.

---

## 1. Variables CSS (globals.css)

Las variables se definen en **HSL** (`H S% L%`). Tailwind las usa así: `hsl(var(--primary))`.

### Modo claro (`:root`)

| Variable | HSL | Uso |
|----------|-----|-----|
| `--background` | 0 0% 100% | Fondo blanco |
| `--foreground` | 220 15% 18% | Texto principal |
| `--card` | 0 0% 100% | Fondos de cards |
| `--primary` | 221 83% 53% | Azul corporativo ≈ **#2563EB** |
| `--primary-foreground` | 0 0% 100% | Texto sobre primary |
| `--secondary` | 220 14% 96% | Secundario |
| `--muted` | 220 14% 96% | Fondos suaves |
| `--muted-foreground` | 220 10% 46% | Texto secundario |
| `--destructive` | 0 72% 51% | Errores / peligro |
| `--warning` | 38 92% 50% | Advertencias |
| `--success` | 160 84% 39% | Éxito |
| `--border` | 220 13% 91% | Bordes |
| `--ring` | 221 83% 53% | Focus (mismo que primary) |
| `--radius` | 0.75rem | Border radius por defecto |

### Modo oscuro (`.dark`) — Orion

| Variable | HSL | Hex / referencia |
|----------|-----|------------------|
| `--background` | 222 33% 8% | **#0B0F1A** (noche/cielo) |
| `--foreground` | 220 13% 91% | Texto claro |
| `--card` | 217 33% 17% | **#1F2937** (cards, popovers) |
| `--primary` | 217 91% 60% | **#3B82F6** (azul Rigel) |
| `--primary-foreground` | 0 0% 100% | Blanco sobre primary |
| `--secondary` | 220 13% 27% | Gris azulado |
| `--muted` | 220 13% 27% | Fondos suaves dark |
| `--muted-foreground` | 220 10% 65% | Texto secundario |
| `--destructive` | 0 62% 45% | Rojo/error |
| `--warning` | 25 95% 53% | Naranja/ámbar ≈ **#F97316** |
| `--success` | 160 84% 45% | Verde éxito |
| `--border` | 220 13% 27% | **#374151** (bordes sutiles) |
| `--input` | 220 13% 27% | Inputs |
| `--ring` | 217 91% 60% | Focus (primary) |

### Fondo “cielo profundo” (dark)

Gradiente sutil en `body::before`:

- `hsl(222 25% 14% / 0.35)` → transparente 55%
- Da profundidad sin saturar; no incluir en paleta base.

---

## 2. Colores fijos usados en UI

Estos se usan en componentes cuando se pide un tono exacto (p. ej. toolbar Listado de ventas):

| Nombre | Hex | Uso |
|--------|-----|-----|
| Fondo toolbar / bloque oscuro | **#111827** | Card de búsqueda/filtros |
| Borde / card oscuro | **#1F2937** | Bordes de cards en dark |
| Primary (azul eléctrico) | **#3B82F6** | Botones primarios, links, acentos |
| Primary (azul royal light) | **#2563EB** | Preset “Azul” en selector |
| Acento naranja (warning) | **#F97316** | Alertas, acentos cálidos |

---

## 3. Presets de tema (themes.ts)

Cada preset define `primary`, `primaryForeground` y `ring` en **HSL** para light y dark. El **swatch** es el color de la muestra en el selector (hex).

| Id | Nombre | Swatch (hex) | Uso |
|----|--------|--------------|-----|
| `blue` | Azul | #2563EB | Por defecto, corporativo |
| `indigo` | Índigo | #4F46E5 | Alternativa más suave |
| `emerald` | Esmeralda | #059669 | Verde profesional |
| `violet` | Violeta | #7C3AED | |
| `amber` | Ámbar | #D97706 | Cálido |
| `slate` | Slate | #475569 | Neutro gris azulado |

Preset por defecto: **blue** (`DEFAULT_THEME_ID`).

---

## 4. Resumen rápido (dark / Orion)

- **Fondo general:** #0B0F1A  
- **Cards / bloques:** #1F2937  
- **Toolbar / bloques más oscuros:** #111827  
- **Primario (botones, links, acentos):** #3B82F6  
- **Bordes:** #374151 (o `border-border`)  
- **Texto principal:** `foreground`  
- **Texto secundario:** `muted-foreground`  
- **Acento naranja (alertas/énfasis):** #F97316  

Evitar verde genérico en CTAs; priorizar azul primario para sensación fintech y control.

---

*Documento generado para guardar la paleta actual. Origen: `apps/web/src/app/globals.css` y `apps/web/src/shared/theme/themes.ts`.*
