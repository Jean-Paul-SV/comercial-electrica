# Checklist de seguridad para PRs

Revisar antes de mergear cambios que toquen API, auth, multi-tenant o datos sensibles.

---

## Multi-tenant y datos

- [ ] Las consultas a BD que devuelven datos de negocio incluyen **siempre** `tenantId` en el `where` (o filtro equivalente).
- [ ] Los nuevos endpoints que devuelven listados o detalle validan que el recurso pertenezca al tenant del usuario (JWT).

## Errores y mensajes

- [ ] Los mensajes de error **no** incluyen IDs internos (UUID, etc.). Usar mensajes genéricos: "Recurso no encontrado", "Cliente no encontrado".
- [ ] Las respuestas de error **no** exponen stack traces ni detalles de BD al cliente (en producción ya se sanitizan; no añadir más detalles sensibles).

## Logs

- [ ] No se loguean contraseñas, tokens ni datos sensibles en claro.
- [ ] NIT, documento de identidad, email, etc. se enmascaran con `maskSensitive()` de `common/utils/sanitize.util.ts` si se incluyen en logs.

## Autenticación y configuración

- [ ] No se añaden nuevos secretos al payload del JWT sin revisión. Preferir datos en BD y leer por `sub`.
- [ ] No se hardcodean credenciales ni URLs de BD. Usar variables de entorno.
- [ ] Si se añade una variable de entorno crítica, valorar incluirla en `ConfigValidationModule`.

## Integraciones (webhooks, APIs externas)

- [ ] Los webhooks (p. ej. Stripe) validan firma o token antes de procesar.
- [ ] No se confía en datos del body sin validar (IDs, tenantId, etc.).

---

**Referencia:** [AUDITORIA_SEGURIDAD_MULTITENANT.md](../docs/AUDITORIA_SEGURIDAD_MULTITENANT.md) y [CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md](../docs/CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md).
