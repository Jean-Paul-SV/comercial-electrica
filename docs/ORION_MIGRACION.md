# Migración al patrón Orion (UI)

Referencia del patrón visual **Orion** aplicado en la app web y estado de la migración desde componentes `Card` de shadcn hacia `div` con clases Tailwind.

## Patrón Orion (clases de referencia)

- **Contenedor de página:** `space-y-10` (o `space-y-8` donde convenga). El **padding** lo aporta el layout (`AppShell`): `<main className="p-4 md:p-6 ...">`. Las páginas no añaden padding propio al contenedor raíz; solo espaciado vertical (`space-y-10`) y, si aplica, ancho máximo (`max-w-5xl mx-auto`).
- **Header de página:**
  - `<header>`, título `text-2xl font-light tracking-tight text-foreground sm:text-3xl`, icono `h-7 w-7 text-primary`, descripción `mt-2 text-sm text-muted-foreground`, botón “Volver” con `rounded-xl` cuando aplique.
- **Bloques tipo toolbar / secundarios:**  
  `rounded-2xl border border-border/50 bg-muted/20 p-5 dark:bg-[#111827] dark:border-[#1F2937]`
- **Cards de contenido (sin componente Card):**  
  `rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] dark:border-[#1F2937]` en un `div`; títulos con `text-lg font-medium` o `text-base font-semibold`, descripciones con `text-sm text-muted-foreground`.
- **Botón primario:** `rounded-xl bg-primary hover:bg-primary/90`.

No se usan `Card`, `CardHeader`, `CardContent`, `CardTitle` ni `CardDescription` en las vistas; el estilo se aplica con `div` y las clases anteriores.

## Estado de la migración

- **Completado:** Todas las páginas que usaban el componente `Card` de shadcn fueron migradas a `div` con el patrón Orion.
  - Dashboard (`app/DashboardView.tsx`)
  - Login, forgot-password, reset-password, accept-invite (páginas públicas)
  - Página de error global (`app/error.tsx`)
- **Ya alineadas con Orion (sin Card):** settings/billing, inventory, plan-required, provider/plans, provider/usage, products/[id], etc. usan directamente el patrón con `div`.
- **Componente `Card` de shadcn:** Sigue existiendo en `shared/components/ui/card.tsx` por si se necesita en otros contextos; las vistas de la app ya no lo importan.

## Padding unificado

- El **área principal** (`<main>`) en `AppShell` tiene `p-4 md:p-6` (y `pb-20 lg:pb-8` por la barra inferior en móvil). Todas las páginas protegidas heredan este padding; no se duplica en el contenedor de cada página.
- **Modales (Dialog):** `DialogContent` usa el patrón Orion: `rounded-2xl border border-border/50 bg-card shadow-sm shadow-black/[0.03] dark:border-[#1F2937]` y **padding fijo `p-6`**. `DialogHeader` tiene `pb-2`, `DialogFooter` tiene `pt-4` y `gap-2`. No hace falta añadir padding extra en el contenido del modal.

## Notas

- Nombres como `PlanCard`, `StockActualCard` o el icono `CreditCard` son solo nombres; no implican uso del componente `Card`.
- Paleta y tema: ver `docs/design-backup/PALETA_ORION.md`.
