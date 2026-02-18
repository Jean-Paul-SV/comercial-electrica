# Auditoría: fugas, mejoras, optimización y responsive móvil

Revisión previa a la migración al dominio. Resumen de lo revisado y lo aplicado.

---

## 1. Fugas (memory leaks / recursos)

### Corregido

- **LoginVideoBackground:** El video se reproducía sin limpieza al desmontar el componente. Se añadió `return () => { video.pause(); }` en el `useEffect` para pausar el video al salir de la página de login.

### Revisado y correcto

- **AppShell:** Los `useEffect` que registran listeners (keydown, open-change-password, body overflow) tienen cleanup con `removeEventListener` y `document.body.style.overflow = ''`.
- **OfflineQueueBell, AlertsBell, ProviderAlertsBell:** Limpieza de `click`/`keydown`/`mousedown` en el return del `useEffect`.
- **Debounce (setTimeout):** Páginas que usan debounce para búsqueda (sales, quotes, customers, suppliers, invoices, audit, etc.) hacen `return () => clearTimeout(t)`.
- **Provider page:** El `setTimeout` de debounce tiene `clearTimeout` en el return.

---

## 2. Seguridad

- **Claves:** Solo se usan variables `NEXT_PUBLIC_*` para datos que pueden ser públicos (URL de la API, WhatsApp de soporte). No hay claves secretas expuestas en el frontend.
- **dangerouslySetInnerHTML:** Solo se usa en `layout.tsx` para el script de tema (contenido estático controlado por el proyecto), no para contenido de usuario.
- **Contraseñas:** Siempre en inputs `type="password"` y no se muestran en logs.

---

## 3. Optimización

- **Vercel/Next:** El proyecto usa `optimizePackageImports` para `lucide-react` (solo los iconos usados).
- **Login:** El video de fondo se carga con `dynamic(..., { ssr: false })` para no bloquear el SSR.
- **Tablas:** El componente `Table` ya envuelve la tabla en un contenedor con `overflow-x-auto` y `-webkit-overflow-scrolling: touch` para scroll horizontal en móvil sin romper el layout.
- **Viewport y tema:** `viewport` y `themeColor` definidos en el layout; `appleWebApp` para mejor experiencia en móvil.

---

## 4. Responsive móvil

### Ya implementado

- **Viewport:** `layout.tsx` exporta `viewport` con `width: device-width`, `initialScale: 1`, `maximumScale: 5`, `viewportFit: cover`.
- **Safe area:** AppShell usa `env(safe-area-inset-*)` en header y en la barra inferior para muescas y gestos.
- **Sidebar:** En `lg:` se oculta el sidebar y se usa menú móvil (drawer `w-[280px] max-w-[85vw]`); barra inferior fija con 4 ítems (Inicio, Ventas, Caja, Menú).
- **Touch targets:** Botones del header y de la barra inferior tienen `min-h-[44px]` o `min-w-[44px]` (recomendación ~44px para áreas táctiles).
- **Tablas:** `Table` con `overflow-x-auto` y `min-w-[640px]` en la tabla interna; en pantallas pequeñas se puede hacer scroll horizontal.
- **Contenido principal:** `main` con `p-4 sm:p-6 md:p-8` y `pb-20 lg:pb-8` para dejar espacio a la barra inferior en móvil.
- **Reduced motion:** En `globals.css` se respeta `prefers-reduced-motion: reduce`.

### Añadido en esta auditoría

- **Touch-action:** En `globals.css` se añadió `touch-action: manipulation` para `input`, `select`, `textarea`, `button` y enlaces en dispositivos táctiles (`pointer: coarse`), para reducir retraso de 300 ms y doble zoom en focos.

### Recomendaciones futuras (opcionales)

- En listados muy largos (ventas, productos, etc.), valorar virtualización (react-window / tanstack virtual) solo si se miden problemas de rendimiento.
- En pantallas muy pequeñas (< 360px), revisar que los modales y formularios no queden cortados; los diálogos ya usan `sm:max-w-lg` o similar.
- Si se añaden más tablas densas, mantener el patrón de envolver en el componente `Table` existente para conservar el scroll horizontal en móvil.

---

## 5. Resumen de cambios realizados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/(public)/login/LoginVideoBackground.tsx` | Cleanup en `useEffect`: pausar video al desmontar. |
| `apps/web/src/app/globals.css` | Regla `@media (pointer: coarse)` con `touch-action: manipulation` para inputs, botones y enlaces. |

---

**Conclusión:** El proyecto está en buen estado respecto a fugas de recursos, seguridad básica y responsive. Con el ajuste del video y el touch-action, se deja listo para la migración al dominio y uso en móvil.
