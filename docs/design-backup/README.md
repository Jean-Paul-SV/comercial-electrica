# Backup del diseño anterior (Orion)

Copia del tema/colores **antes** de aplicar la identidad "Orion Rigel/Betelgeuse" (dark mode fintech).

## Archivos

- **globals.css.backup** – Variables CSS (`:root` y `.dark`) del diseño anterior.
- **PALETA_ORION.md** – Referencia de la paleta de colores actual (Orion): variables CSS, hex usados en UI y presets de tema.

## Cómo restaurar el diseño anterior

1. Copia el contenido de `globals.css.backup` sobre `apps/web/src/app/globals.css`.
2. En `apps/web/src/app/layout.tsx`, en el script `themeScript`, cambia la línea de `dark` a:
   `var dark=d===null?(typeof matchMedia!=='undefined'&&matchMedia('(prefers-color-scheme: dark)').matches):d==='true';`
   y en `themeColor` vuelve a `#0f172a` para dark.
3. En `apps/web/src/shared/theme/ThemeProvider.tsx`, en el `else` de `storedDark`, vuelve a:
   `setDarkModeState(typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);`
4. En `themes.ts`, preset `blue.dark`, vuelve a `primary: '221 83% 58%'`, `ring: '221 83% 58%'`.

Fecha del backup: al aplicar el nuevo diseño Orion.
