# Pruebas manuales de seguridad

Checklist para validar las correcciones de seguridad. Algunas comprobaciones pueden ejecutarse con el **script automático** (ver más abajo).

---

## Script automático (recomendado)

Con la API corriendo, ejecuta:

```bash
node scripts/verificar-seguridad-api.js
```

O con credenciales y URL custom:

```bash
API_URL=http://localhost:3000 API_EMAIL=tu@email.com API_PASSWORD=TuPass node scripts/verificar-seguridad-api.js
```

El script comprueba:
- **Login** correcto.
- **JWT sin campo `email`** en el payload.
- **Respuesta de error sin UUIDs** al intentar crear una venta con IDs inexistentes (mensaje genérico "Cliente no encontrado" / "Sesión de caja no encontrada" sin exponer IDs).

Si algo falla, el script sale con código 1. Las pruebas 4, 5 y 6 (logs enmascarados, stack en producción, webhook Stripe) siguen siendo manuales.

---

## Requisitos

- API corriendo en local (`npm run start` o `npm run dev` desde `apps/api`).
- Base de datos y Redis disponibles.
- Usuario de prueba (por defecto `test@example.com` / `Test123!` si usaste bootstrap-admin).

---

## 1. Validación de configuración al arranque

**Objetivo:** Comprobar que la API no arranca sin variables críticas.

**Nota:** Esto está cubierto por tests automáticos (`config-validation.module.spec.ts`). Opcionalmente puedes comprobarlo en local:

1. En una terminal, desde `apps/api`, borra o renombra temporalmente la variable:
   ```powershell
   $env:DATABASE_URL = ""
   npm run start
   ```
2. **Esperado:** La API debe fallar al iniciar con un mensaje claro tipo "Variables de entorno faltantes" o "DATABASE_URL".
3. Restaura `DATABASE_URL` (cierra la terminal y abre una nueva, o define de nuevo la variable) y arranca de nuevo. Debe levantar bien.

---

## 2. JWT sin email en el payload

**Objetivo:** Confirmar que el token no incluye el email.

**Automático:** Lo comprueba `scripts/verificar-seguridad-api.js`.

**Manual:**
1. Haz login por la app o con `POST /auth/login` (body: `{ "email": "...", "password": "..." }`).
2. Copia el `accessToken` de la respuesta.
3. Ve a [jwt.io](https://jwt.io), pega el token en "Encoded".
4. En "Payload" **no** debe aparecer el campo `email`. Debe haber `sub`, `role`, `tenantId`, `isPlatformAdmin`, etc.

---

## 3. Errores sin IDs internos

**Objetivo:** Ver que las respuestas de error no exponen UUIDs.

**Automático:** Lo comprueba `scripts/verificar-seguridad-api.js` (POST /sales con IDs inexistentes).

**Manual:**
1. Con un token válido, crea una venta enviando un `customerId` / `cashSessionId` que sean UUIDs inventados.
2. **Esperado:** Respuesta 404 (o 400) con mensaje tipo "Cliente no encontrado" o "Sesión de caja no encontrada". El cuerpo **no** debe incluir el UUID.
3. Opcional: Repite con sesión de caja inexistente. Debe decir "Sesión de caja no encontrada" sin el ID.

---

## 4. Logs con datos enmascarados

**Objetivo:** Ver que NIT/documento salen enmascarados en logs.

1. Con la API en marcha y logs visibles en consola, crea un **proveedor** con un NIT de prueba (ej. 900123456).
2. Revisa la línea de log correspondiente (creación de proveedor).
3. **Esperado:** Donde antes podía salir el NIT completo, debe aparecer algo como `***3456` (solo últimos dígitos).
4. Opcional: Crea un **cliente** con documento de prueba y comprueba que en log el documento aparece enmascarado.

---

## 5. Stack trace oculto en producción

**Objetivo:** En entorno "producción", los logs no muestran stack completo.

1. Pon `NODE_ENV=production` y arranca la API (o usa un build de producción).
2. Provoca un error 500 (por ejemplo llamando a un endpoint que falle por BD o lanzando un error no controlado en un endpoint de prueba).
3. Revisa el log del error.
4. **Esperado:** No debe verse el stack trace completo; debe aparecer un mensaje tipo "[Stack trace oculto en producción]".

---

## 6. Webhook Stripe (solo si usas Stripe)

**Objetivo:** En producción, sin `STRIPE_WEBHOOK_SECRET` el webhook responde 500.

1. En un entorno con `NODE_ENV=production`, asegúrate de que **no** esté definido `STRIPE_WEBHOOK_SECRET` (o quítalo temporalmente).
2. Envía un POST a la URL del webhook de Stripe (o simula uno con `stripe trigger`).
3. **Esperado:** Respuesta 500 con mensaje tipo "Webhook no configurado".
4. Define de nuevo `STRIPE_WEBHOOK_SECRET` y reinicia; el siguiente webhook válido debe procesarse (o 400 si la firma es inválida, pero no 500 por "no configurado").

---

## Resumen

| # | Prueba                         | Cómo comprobar                          |
|---|--------------------------------|-----------------------------------------|
| 1 | Config al arranque             | Test automático (`config-validation.module.spec.ts`) + opcional manual |
| 2 | JWT sin email                  | Script `verificar-seguridad-api.js` o jwt.io sin campo `email` |
| 3 | Errores sin IDs                | Script `verificar-seguridad-api.js` o POST /sales con IDs falsos |
| 4 | Logs enmascarados              | Manual: NIT/documento como `***1234` en logs |
| 5 | Stack en producción            | Manual: log de 500 sin stack completo   |
| 6 | Webhook Stripe config          | Manual: 500 si falta secret en producción |

Si alguna no se cumple, revisar [CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md](./CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md) y [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) (sección Seguridad).
