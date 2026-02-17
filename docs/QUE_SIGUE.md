# ¿Qué sigue? – Próximos pasos del proyecto

**Fecha:** 2026-02-11  
**Contexto:** Auditoría de seguridad implementada; proyecto listo para pruebas y preparación a producción.

---

## 1. Inmediato (esta semana)

### 1.1 Probar las correcciones de seguridad
- [ ] Arrancar API con y sin `DATABASE_URL` → debe fallar con mensaje claro si falta.
- [ ] Login → decodificar JWT (ej. [jwt.io](https://jwt.io)) y comprobar que **no** incluye `email`.
- [ ] Crear venta con `customerId` inexistente → respuesta "Cliente no encontrado" **sin** ID.
- [ ] Crear proveedor/cliente y revisar logs → NIT/documento enmascarado (ej. `***1234`).
- [ ] En producción (o `NODE_ENV=production`): provocar un 500 y revisar que los logs **no** muestren stack trace completo.

**Guía paso a paso:** [PRUEBAS_MANUALES_SEGURIDAD.md](./PRUEBAS_MANUALES_SEGURIDAD.md)  
**Script automático (JWT + errores sin UUIDs):** `node scripts/verificar-seguridad-api.js` (con la API corriendo).

### 1.2 Verificar que la API arranca
- [x] `npm run build` en `apps/api` sin errores.
- [ ] `npm run start` (o `dev`) y comprobar que `ConfigValidationModule` valida y no rompe el arranque con variables correctas.

---

## 2. Corto plazo (antes de producción)

### 2.1 Endpoints de auditoría (verificado)
Los endpoints de auditoría **ya filtran por tenant** (`audit.controller.ts`: `effectiveTenantId` y `where.tenantId`). No hay acción pendiente; el checklist de la auditoría puede marcarse como cumplido.

### 2.2 Tests
- [x] Tests de `AuthService` actualizados y pasando (payload JWT sin email, mocks de PlanLimitsService, tenant, $transaction).
- [x] Tests de `CashService` corregidos y pasando (10/10 tests).
- [x] Tests de `InventoryService` corregidos y pasando (9/9 tests).
- [x] Tests de `SalesService`, `QuotesService`, `BillingService` y `ValidationLimitsService` corregidos; **suite completa 106 tests pasando**.
- [x] Test que verifica que las respuestas de error no incluyen UUIDs en el mensaje (`http-exception.filter.spec.ts`).
- [x] Revisar que los tests de multi-tenant sigan pasando (suite 109 tests).

**Ver:** [TESTS_CORREGIDOS.md](./TESTS_CORREGIDOS.md) para detalles.

### 2.3 Variables de entorno en producción
- [ ] Definir en el entorno de producción:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET`
  - `STRIPE_WEBHOOK_SECRET` (si usas Stripe en producción).
- [ ] Confirmar que no queden credenciales en código (ya eliminado el fallback en Prisma).

### 2.4 Documentación operativa
- [x] Revisar `RUNBOOK_OPERACIONES.md` y `TROUBLESHOOTING.md` con los nuevos comportamientos (runbook actualizado con variables obligatorias y comprobación pre-despliegue).
- [x] Incluir en runbook de despliegue la comprobación de las variables (DATABASE_URL, JWT_ACCESS_SECRET, STRIPE_WEBHOOK_SECRET).

---

## 3. Mejoras opcionales (riesgo bajo)

### 3.1 Logs de queries lentas
- En `QueryPerformanceService`, si en el futuro se loguean `params`, asegurar que no se incluyan datos sensibles (o sanitizarlos).
- No es urgente si hoy solo se loguea el texto de la query (primeros 100 caracteres).

### 3.2 Guía de respuesta a incidentes
- [x] Guía en [RESPUESTA_INCIDENTES.md](./RESPUESTA_INCIDENTES.md): fuga de datos, JWT comprometido, webhooks Stripe, credenciales expuestas, 5xx.
- [ ] Revisar contactos (soporte, proveedor) y dónde mirar logs según tu entorno.

### 3.3 Revisión de seguridad en PRs
- [ ] Definir checklist en PR (ej. “no exponer IDs en mensajes de error”, “no loguear datos sensibles sin enmascarar”).
- [ ] Opcional: regla en CI que busque patrones peligrosos (ej. `throw new.*\$\{.*id`).

---

## 4. Antes de lanzamiento público

- [ ] **Auditoría externa** (recomendado): contratar una revisión de seguridad independiente antes de abrir a clientes.
- [ ] **Backups y restauración**: probar restauración desde backup en un entorno tipo staging.
- [ ] **Monitoreo**: confirmar que alertas (Slack, email, etc.) están activas y que se reciben correctamente en producción.

---

## 5. Resumen visual

| Prioridad   | Acción                                      | Estado  |
|------------|---------------------------------------------|--------|
| Inmediato  | Probar correcciones de seguridad            | Pendiente |
| Inmediato  | Build y arranque con validación de config   | Pendiente |
| Pre-prod   | Tests y variables de entorno en prod         | Pendiente |
| Pre-prod   | Actualizar runbook/troubleshooting          | Pendiente |
| Opcional   | Guía respuesta a incidentes                 | Pendiente |
| Opcional   | Checklist de seguridad en PRs                | Pendiente |
| Lanzamiento| Auditoría externa (recomendado)             | Pendiente |

---

## 6. Referencias

- [Auditoría de seguridad](./AUDITORIA_SEGURIDAD_MULTITENANT.md)
- [Correcciones implementadas](./CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md)
- [Estado del proyecto](./ESTADO_PROYECTO.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Runbook operaciones](./RUNBOOK_OPERACIONES.md)
- [Respuesta a incidentes](./RESPUESTA_INCIDENTES.md)
- [Pruebas manuales de seguridad](./PRUEBAS_MANUALES_SEGURIDAD.md)
- Checklist seguridad PRs: `.github/SECURITY_CHECKLIST.md` (en el repo)
