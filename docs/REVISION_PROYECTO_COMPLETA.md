# Revisión completa del proyecto Comercial-Electrica (Orion)

Revisión técnica realizada sobre la estructura, seguridad, consistencia y posibles mejoras del monorepo. Fecha de referencia: febrero 2026.

---

## 1. Resumen ejecutivo

| Área            | Valoración | Comentario breve |
|-----------------|------------|-------------------|
| Estructura      | ✅ Muy buena | Monorepo claro (api + web), módulos bien separados. |
| Seguridad       | ✅ Buena   | Aislamiento por tenant consistente; auth y env validados. |
| API             | ✅ Buena   | DTOs, filtro global de excepciones, throttling, auditoría. |
| Frontend        | ✅ Buena   | Next.js 15, features por dominio, manejo de errores centralizado. |
| Documentación   | ✅ Buena   | README, docs/, env.example y runbooks útiles. |
| Tests           | ✅ Aceptable | Unitarios API; E2E varios (feedback, provider, sales, etc.). |
| Deuda técnica  | 🟡 Baja    | Sin TODOs/FIXME; algunos detalles de consistencia. |

**Conclusión:** El proyecto está en buen estado para producción, con multitenancy, facturación (Stripe/PayU), DIAN, billing SaaS y panel proveedor. Las recomendaciones siguientes son mejoras incrementales, no bloqueantes.

---

## 2. Estructura y arquitectura

### 2.1 Monorepo

- **Raíz:** `package.json` con workspaces `["apps/*"]`, scripts para `dev`, `db:up`, Prisma, tests.
- **apps/api:** NestJS, Prisma, Redis, BullMQ, módulos por dominio (auth, sales, catalog, billing, provider, feedback, dian, etc.).
- **apps/web:** Next.js 15 (App Router), `src/app/(protected)|(public)`, `src/features/*`, `src/shared/*`.

La separación entre API y frontend es clara; las features del web se apoyan en hooks y clientes API por dominio.

### 2.2 API (NestJS)

- **Configuración:** `ConfigModule` con `envFilePath` múltiple y `validateEnv` en arranque.
- **Global:** `ThrottlerModule` (límites por tipo: short, medium, long, login, forgot, reports, export), `ValidationPipe`, filtro de excepciones global, interceptores (TenantContext, AuditContext, Idempotency, RequestMetrics).
- **Guards:** `JwtAuthGuard`, `PermissionsGuard`, `ModulesGuard`, `PlatformAdminGuard`, `ThrottleAuthGuard`.

Los controladores pasan `req.user?.tenantId` a los servicios; los servicios usan `TenantContextService.ensureTenant(tenantId)` y filtran con `where: { tenantId: currentTenantId }`. Patrón consistente en sales, customers, suppliers, expenses, purchases, catalog, inventory, reports, etc.

### 2.3 Frontend (Next.js)

- Rutas protegidas bajo `(protected)`, públicas bajo `(public)` (p. ej. login).
- `AuthProvider` y layout que condicionan sidebar y redirección según suscripción/pago pendiente.
- Utilidad compartida `getErrorMessage()` en `shared/utils/errors.ts` para mensajes de error al usuario; uso de `toast` (sonner) en formularios.

---

## 3. Seguridad

### 3.1 Aislamiento multi-tenant

- **Origen del tenant:** JWT (`tenantId`) + `TenantContextInterceptor` que rellena `tenantId` cuando falta (p. ej. tokens antiguos).
- **Uso en servicios:** Listados y operaciones usan `tenantContext.ensureTenant(tenantId)` y cláusulas `where: { tenantId: currentTenantId }`. Revisados: sales, customers, suppliers, supplier-invoices, purchases, expenses, catalog, inventory, reports (incl. `$queryRaw` con `WHERE p."tenantId" = ${tenantId}::uuid`).
- **Panel proveedor:** `PlatformAdminGuard` restringe acceso a usuarios con `tenantId === null` o `isPlatformAdmin === true` o email en lista de plataforma; no se delega el `tenantId` desde el cliente para usuarios normales.
- **Stats:** `GET /stats?tenantId=` solo acepta `tenantId` query cuando `req.user?.isPlatformAdmin`; si no, se usa `req.user?.tenantId`. Correcto.

No se detectaron endpoints que permitan a un tenant acceder a datos de otro sin ser platform admin.

### 3.2 Autenticación y autorización

- Login con restricción por lista de correos (`ALLOWED_LOGIN_EMAILS` o `PLATFORM_ADMIN_EMAIL`); en `NODE_ENV=test` se omite esta restricción para E2E.
- Permisos por rol (RBAC) con `PermissionsGuard` y decorador `@RequirePermission()`.
- Módulos por tenant con `ModulesGuard` y `@RequireModule()` (p. ej. `advanced_reports` para reportes avanzados; dashboard usa `@RequireModule()` sin argumento para estar disponible en todos los planes).

### 3.3 Configuración y secretos

- **Validación de env:** `config/env.validation.ts` exige en todos los entornos `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`; en producción además `JWT_REFRESH_SECRET`.
- **.gitignore:** Incluye `.env` y `.env.*` (con excepción de `.env.example`). No se suben secretos al repo.
- **Uso de process.env:** Concentrado en auth, config, prisma, throttler, filters, algunos servicios (billing, dian, plan-limits, etc.). En producción conviene no depender de variables no documentadas en `env.example`.

### 3.4 Recomendaciones de seguridad

1. **Archivo `.en`:** En el estado del repo aparece un archivo sin seguimiento `.en`. Si es un resto de `.env`, conviene eliminarlo y asegurarse de que no contenga datos sensibles.
2. **CORS:** En producción definir `ALLOWED_ORIGINS` y usarla en la API para no abrir CORS a cualquier origen.
3. **Rate limiting:** Los límites por defecto (login, forgot, reports, export) están bien; en producción verificar que `THROTTLE_LOGIN_DISABLED` no esté en `true` salvo mantenimiento puntual.

---

## 4. API – buenas prácticas y consistencia

### 4.1 Positivo

- **Filtro global de excepciones:** Convierte errores de Prisma (P2002, P2025, P2003, etc.) a respuestas HTTP coherentes (409, 404, 400, etc.) y unifica el formato de error (statusCode, error, message, details).
- **DTOs y validación:** Uso de class-validator y ValidationPipe; DTOs por operación (create, update, list query).
- **Transacciones:** Operaciones críticas (venta, inventario, etc.) usan `prisma.$transaction` cuando hay múltiples escrituras.
- **Inventario y StockBalance:** `StockBalance` no tiene `tenantId` pero se accede siempre a través de `Product` (con `tenantId`); en inventory y create-sale se validan productos por tenant antes de tocar stock. Correcto.
- **Idempotencia:** Interceptor y uso en creación de ventas para evitar duplicados por reintentos.

### 4.2 Consultas raw

- **reports.service.ts:** `$queryRaw` para reporte de stock bajo incluye `WHERE p."tenantId" = ${tenantId}::uuid`. Seguro.
- **catalog.service.ts:** Uso de `$queryRaw` en búsqueda; revisar que el parámetro de tenant esté siempre inyectado (no concatenar entrada de usuario en SQL).
- **app.service.ts:** `$queryRaw\`SELECT 1\`` sin parámetros; solo health check. Sin riesgo.

### 4.3 Sugerencias API

1. **Documentar en env.example** cualquier variable que la API use en tiempo de ejecución y que aún no esté (por ejemplo variables de alertas, métricas, DIAN, Stripe, PayU están ya referenciadas en el ejemplo).
2. **Deprecación ts-jest:** El aviso de Jest sobre `isolatedModules` en ts-jest se puede resolver configurando `isolatedModules: true` en `apps/api/tsconfig.json` cuando se actualice la herramienta.

---

## 5. Frontend – buenas prácticas y consistencia

### 5.1 Positivo

- **Manejo de errores:** `getErrorMessage()` centraliza mensajes por tipo de error y código HTTP; páginas usan toast para feedback.
- **Auth y token:** El token se obtiene del contexto (`useAuth()`); no hay tokens hardcodeados.
- **Features por dominio:** auth, billing, sales, feedback, provider, etc., con `api.ts` + `hooks.ts` (y a veces `types.ts`), lo que facilita mantenimiento.

### 5.2 Posible mejora

- En **sales/page.tsx** el `onError` del submit tiene lógica larga para extraer el mensaje (varias ramas con `errorObj?.message`, `(e as any)?.message`, etc.). Se podría reutilizar `getErrorMessage(error)` de `shared/utils/errors.ts` para unificar y acortar el código.

---

## 6. Tests

- **Unitarios (API):** Múltiples specs (app, sales, plan-limits, etc.); 113 tests pasando según contexto reciente.
- **E2E:** Suites para app, feedback, provider, permissions, sales, quotes, inventory, backups, reports, cash, suppliers-purchases-payables, multi-tenant, Stripe, plan-limits, etc.
- **Helpers:** `test-helpers.ts` con `cleanDatabase` (orden de tablas correcto, tolerancia a tablas inexistentes), `setupTestApp`, `setupTestAppForPlatformAdmin`, `shutdownTestApp` defensivo ante fallos en `beforeAll`.
- **Documentación:** `docs/CHECKLIST_E2E.md` describe cómo ejecutar E2E y un checklist manual de rutas críticas.

Recomendación: mantener la costumbre de añadir limpieza de nuevas tablas en `cleanDatabase` cuando se agreguen modelos con FK, y reutilizar los helpers para nuevos E2E.

---

## 7. Documentación y operación

- **README.md:** Inicio rápido, checklist de despliegue, DIAN, seguridad, backups, monitoreo y alta de clientes. Muy útil.
- **docs/:** Incluye DEPLOY, ESTADO_PROYECTO, BACKUP_RESTORE_ESTRATEGIA, ALERTAS_CONFIGURACION, RUNBOOK_OPERACIONES, TROUBLESHOOTING, GUIA_PRUEBAS_MANUALES, CHECKLIST_E2E, auditorías de seguridad, etc.
- **env.example:** Amplio y alineado con la validación de env de la API; buena base para producción.

No se detectaron TODOs ni FIXME en el código; el proyecto está limpio en ese aspecto.

---

## 8. Checklist de acciones recomendadas (prioridad)

| Prioridad | Acción |
|----------|--------|
| Alta     | Revisar o eliminar el archivo `.en` en la raíz si es un resto de `.env`. |
| Alta     | En producción: configurar `ALLOWED_ORIGINS` y no dejar CORS abierto. |
| Media    | Unificar mensajes de error en formularios del frontend usando `getErrorMessage()` donde aún se duplique lógica. |
| Media    | Añadir `isolatedModules: true` en `apps/api/tsconfig.json` cuando se actualice ts-jest, para quitar el warning. |
| Baja     | Revisar que todas las variables usadas por la API en runtime estén en `env.example` o documentadas. |

---

## 9. Conclusión

El proyecto Comercial-Electrica (Orion) está bien estructurado, con aislamiento multi-tenant aplicado de forma consistente, autenticación y autorización claras, manejo de errores y throttling en la API, y documentación operativa suficiente. La revisión no encontró vulnerabilidades críticas ni fugas de datos entre tenants. Las mejoras sugeridas son incrementales (limpieza de archivos, CORS, consistencia de mensajes de error y configuración de herramientas). El estado es adecuado para seguir desplegando y operando en producción con los controles ya documentados (backups, alertas, runbooks).
