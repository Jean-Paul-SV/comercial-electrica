# Checklist E2E (tests automáticos y rutas críticas)

Resumen de tests E2E automatizados y checklist manual para rutas críticas antes de releases.

---

## 1. Tests E2E automatizados (API)

**Requisitos:** PostgreSQL y Redis (p. ej. `npm run db:up`), variables de entorno en `apps/api/.env` (o `.env` en raíz). Aplicar migraciones pendientes (`npx prisma migrate deploy` en `apps/api`) para que existan todas las tablas; por ejemplo, `feedback.e2e-spec.ts` necesita la tabla `TenantFeedback` (migración `20260220100000_add_tenant_feedback`). El seed no es obligatorio para la mayoría; algunos specs (p. ej. provider) esperan rol `admin` con `tenantId` null (seed o migraciones).

### Ejecutar todos los E2E

```powershell
cd apps/api
npx jest -c test/jest-e2e.json --runInBand
```

### Ejecutar un solo archivo

```powershell
npx jest -c test/jest-e2e.json --runInBand test/feedback.e2e-spec.ts
npx jest -c test/jest-e2e.json --runInBand test/provider.e2e-spec.ts
```

### Especificaciones E2E disponibles

| Archivo | Qué cubre |
|--------|------------|
| `app.e2e-spec.ts` | Health GET / |
| `feedback.e2e-spec.ts` | POST/GET feedback (tenant), GET/PATCH provider/feedback (platform) |
| `provider.e2e-spec.ts` | Planes, tenants, backup, DIAN activations, feedback (provider) |
| `permissions.e2e-spec.ts` | Permisos por rol (ej. cash:create) |
| `sales.e2e-spec.ts` | Ventas, facturas |
| `quotes.e2e-spec.ts` | Cotizaciones |
| `inventory.e2e-spec.ts` | Inventario |
| `backups.e2e-spec.ts` | Backups |
| `reports.e2e-spec.ts` | Reportes / dashboard |
| `cash.e2e-spec.ts` | Caja |
| `suppliers-purchases-payables.e2e-spec.ts` | Proveedores, compras, cuentas por pagar |
| `multi-tenant-*.e2e-spec.ts` | Aislamiento multi-tenant |
| `stripe-*.e2e-spec.ts` | Stripe webhooks / idempotencia |
| `plan-limits.e2e-spec.ts` | Límites por plan |
| Otros | Rate limiting, stats, dian-multitenant, etc. |

Tras añadir funcionalidad nueva (p. ej. feedback), conviene tener un E2E que cubra el flujo principal; `feedback.e2e-spec.ts` es el ejemplo para sugerencias (tenant + provider).

---

## 2. Checklist manual – rutas críticas

Completar antes de considerar estable un release. Asumir entorno local o staging con BD y seed aplicado.

### Login y roles

- [ ] Login con usuario **tenant** (ej. `admin@negocio.local`) → redirección al dashboard del negocio.
- [ ] Login con usuario **plataforma** (ej. `platform@proveedor.local`) → acceso al panel proveedor.
- [ ] Ruta protegida sin token → redirección a login (o 401 en API).

### Dashboard (todos los planes)

- [ ] Plan básico: dashboard muestra resumen del día / indicadores sin “Módulo no contratado”.
- [ ] Plan con reportes avanzados: mismos datos y opcionalmente reportes avanzados.

### Facturación (billing) y suscripción

- [ ] Cuenta → Facturación: se ve estado de suscripción (activa, pendiente pago, etc.).
- [ ] Si hay pago pendiente: flujo “Completar pago” (Stripe) y que no haya flash de menú al cargar.
- [ ] Cambio de plan (si aplica): cambio correcto y, si el plan incluye DIAN, aparición en “Activaciones DIAN pendientes” en el panel proveedor.

### Sugerencias (feedback)

- [ ] **Tenant:** Cuenta → Sugerencias: enviar una sugerencia y verla en “Mis sugerencias enviadas”.
- [ ] **Provider:** Panel proveedor → Sugerencias: ver listado de sugerencias, filtrar por estado y marcar como Leída/Resuelta.

### Panel proveedor

- [ ] Listar empresas (tenants) y ver detalle.
- [ ] Activaciones DIAN pendientes: listado y marcar una como “Completada”.
- [ ] (Opcional) Crear/editar empresa, planes, backups.

### Ventas y facturación electrónica

- [ ] Registrar venta y ver factura (local o electrónica según configuración).
- [ ] Listado de facturas coherente con el tenant.

### Caja, gastos, proveedores

- [ ] Abrir/cerrar caja y ver movimientos.
- [ ] Crear gasto y verlo en listado.
- [ ] Crear/editar proveedor y que persista bien.

---

## 3. Mantenimiento

- **Limpieza en tests:** Si se añaden modelos nuevos con FK (p. ej. `TenantFeedback`), añadir el `deleteMany` correspondiente en `test-helpers.ts` (`cleanDatabase`) en el orden correcto (hijos antes que padres).
- **Nuevos E2E:** Reutilizar `setupTestApp` (tenant) y/o `setupTestAppForPlatformAdmin` (plataforma) según el flujo; ver `feedback.e2e-spec.ts` y `provider.e2e-spec.ts` como referencia.

Cuando “prosiga” el trabajo, este checklist y los E2E permiten validar que las rutas críticas (login, dashboard, billing, feedback, provider, ventas) siguen funcionando tras cambios.
