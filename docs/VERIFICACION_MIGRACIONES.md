# Verificación de migraciones (staging y producción)

> **Objetivo:** Asegurar que el esquema de la base de datos está al día en cada entorno antes y después de desplegar.  
> **Referencia:** `QUE_FALTA_DESPUES_SPRINT1.md`, `AUDITORIA_CTO_HARDENING_FEB2026.md`.

---

## Por qué importa

- La API espera tablas y columnas definidas en las migraciones de Prisma (ej. `StripeEvent` para idempotencia de webhooks Stripe).
- Si faltan migraciones, pueden producirse errores 500 o fallos silenciosos (p. ej. webhooks duplicados).

---

## Comandos

Desde la raíz del monorepo o desde `apps/api`:

```bash
# Ver estado (sin aplicar nada)
cd apps/api
npx prisma migrate status
```

Salida esperada si todo está al día:

```
Database schema is up to date!
```

Si hay migraciones pendientes:

```
X migration(s) pending:
  - 20260209150000_add_stripe_event_idempotency
```

Aplicar en **staging o producción** (nunca `migrate dev` en estos entornos):

```bash
npx prisma migrate deploy
```

En **desarrollo** (local), para crear y aplicar una nueva migración:

```bash
npx prisma migrate dev --name nombre_descriptivo
```

---

## Cuándo ejecutar

| Momento | Acción |
|---------|--------|
| **Antes de desplegar** | En el entorno objetivo, ejecutar `migrate status`. Si hay pendientes, aplicar `migrate deploy` como paso del pipeline o manualmente antes de reiniciar la API. |
| **Después de desplegar** | Comprobar que la API arranca y que `GET /health` responde OK. |
| **Al menos una vez por entorno** | Verificar que la migración de `StripeEvent` (y cualquier otra reciente) está aplicada. |

---

## Variables necesarias

`prisma migrate` usa la variable de entorno **`DATABASE_URL`** (o la definida en `schema.prisma`). Asegurarse de que en el servidor o en el pipeline esté configurada la URL correcta para ese entorno (staging vs producción).

---

**Última actualización:** Febrero 2026
