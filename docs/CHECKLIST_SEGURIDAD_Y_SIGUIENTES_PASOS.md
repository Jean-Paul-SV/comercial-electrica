# Checklist – Seguridad y siguientes pasos

**Última actualización:** 2026-02-11

---

## Parte 1: Correcciones de seguridad (implementadas)

### Aislamiento multi-tenant
- [x] Todas las queries incluyen `tenantId` en `where`
- [x] Los servicios validan `tenantId` del JWT
- [x] No hay queries sin filtro por tenant
- [x] Endpoints de auditoría filtran por tenant

### Control de acceso
- [x] Uso de `PermissionsGuard` y `@RequirePermission()`
- [x] Validación de ownership en updates/deletes
- [x] Platform admin guard protege `/provider/*`

### Autenticación
- [x] JWT con secret desde entorno
- [x] Validación de expiración
- [x] Email removido del payload del JWT

### Errores y logs
- [x] Filtro global de excepciones
- [x] IDs removidos de mensajes de error (NotFoundException, BadRequestException)
- [x] Datos sensibles enmascarados en logs (NIT, docNumber con `maskSensitive`)
- [x] Stack traces sanitizados en producción

### Integraciones (Stripe)
- [x] Webhooks con validación de firma
- [x] Validación de `STRIPE_WEBHOOK_SECRET` en producción

### Configuración
- [x] Secretos solo por variables de entorno
- [x] Validación de configuración al arranque (`ConfigValidationModule`)
- [x] Credenciales hardcodeadas eliminadas (Prisma sin fallback de `DATABASE_URL`)

### Tests
- [x] Suite de tests pasando (113 tests en 12 suites)
- [x] Test que verifica que las respuestas de error no incluyen UUIDs en el mensaje (`http-exception.filter.spec.ts`)
- [x] Test que verifica que la API no arranca sin variables críticas (`config-validation.module.spec.ts`)

---

## Parte 2: Pendiente / siguientes pasos

### Inmediato (esta semana)
- [ ] **Probar correcciones de seguridad** (guía: [PRUEBAS_MANUALES_SEGURIDAD.md](./PRUEBAS_MANUALES_SEGURIDAD.md)):
  - [x] API sin `DATABASE_URL` / `JWT_ACCESS_SECRET` → falla con mensaje claro (test automático en `config-validation.module.spec.ts`)
  - [ ] JWT sin email + errores sin UUIDs: ejecutar `node scripts/verificar-seguridad-api.js` con la API en marcha
  - [ ] Logs: NIT/documento enmascarado (ej. `***1234`) — manual
  - [ ] En producción: 500 sin stack trace completo en logs — manual
- [x] Build verificado (`npm run build` en `apps/api` sin errores)
- [ ] Arrancar API con `npm run start` / `npm run dev` (con `.env` con `DATABASE_URL` y `JWT_ACCESS_SECRET`) y comprobar que la validación de config no rompe

### Corto plazo (antes de producción)
- [ ] Definir en producción: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `STRIPE_WEBHOOK_SECRET` (si aplica)
- [x] Revisar `RUNBOOK_OPERACIONES.md` y `TROUBLESHOOTING.md` con los nuevos comportamientos (runbook actualizado con variables obligatorias y comprobación pre-despliegue)
- [x] Incluir en runbook de despliegue la comprobación de las variables anteriores

### Opcional
- [x] Guía de respuesta a incidentes (completa en [RESPUESTA_INCIDENTES.md](./RESPUESTA_INCIDENTES.md))
- [ ] Checklist de seguridad en PRs (existe [.github/SECURITY_CHECKLIST.md](../.github/SECURITY_CHECKLIST.md); usarlo en cada PR)

### Antes de lanzamiento público
- [ ] Auditoría externa de seguridad (recomendado)
- [ ] Probar restauración desde backup en staging
- [ ] Confirmar que alertas y monitoreo funcionan en producción

---

## Resumen rápido

| Área              | Estado      |
|-------------------|------------|
| Correcciones de seguridad | ✅ Hecho |
| Tests (113)       | ✅ Pasando |
| Pruebas manuales  | ⏳ Pendiente (guía en PRUEBAS_MANUALES_SEGURIDAD.md) |
| Variables en prod | ⏳ Pendiente |
| Runbook / troubleshooting | ✅ Actualizado |
| Lanzamiento      | ⏳ Pendiente |

Referencias: [AUDITORIA_SEGURIDAD_MULTITENANT.md](./AUDITORIA_SEGURIDAD_MULTITENANT.md), [CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md](./CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md), [QUE_SIGUE.md](./QUE_SIGUE.md).
