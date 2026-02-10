# Runbook: Rotación de secretos

> **Objetivo:** Rotar de forma segura los secretos de la aplicación (JWT, Stripe, base de datos) en caso de compromiso o mantenimiento periódico.  
> **Quién:** Operaciones o DevOps.  
> **Referencia:** `HARDENING_TECNICO_PRODUCCION.md`, `AUDITORIA_CTO_HARDENING_FEB2026.md`.

---

## 1. JWT (JWT_ACCESS_SECRET)

**Cuándo:** Compromiso del secreto, o rotación periódica (ej. cada 6–12 meses).

| Paso | Acción |
|------|--------|
| 1.1 | Generar un nuevo secreto seguro: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` (o equivalente). |
| 1.2 | Actualizar la variable de entorno `JWT_ACCESS_SECRET` en el entorno afectado (staging/producción). |
| 1.3 | Reiniciar la API para que cargue el nuevo secreto. |
| 1.4 | **Efecto:** Todos los tokens JWT emitidos con el secreto anterior dejarán de ser válidos. Los usuarios tendrán que iniciar sesión de nuevo. |
| 1.5 | Verificar: hacer login con un usuario de prueba y una petición autenticada (ej. GET /auth/me). |

**Nota:** No es necesario tocar la base de datos. El refresh token (si existe) usa el mismo secreto; al rotar, también dejará de funcionar hasta nuevo login.

---

## 2. Stripe (STRIPE_WEBHOOK_SECRET)

**Cuándo:** Compromiso del webhook secret, o regeneración desde el Dashboard de Stripe.

| Paso | Acción |
|------|--------|
| 2.1 | En Stripe Dashboard: **Developers → Webhooks** → seleccionar el endpoint → **Regenerar signing secret** (o crear un nuevo endpoint y copiar el secret). |
| 2.2 | Actualizar la variable `STRIPE_WEBHOOK_SECRET` en el entorno. |
| 2.3 | Reiniciar la API. |
| 2.4 | **Efecto:** Los eventos que Stripe envíe con la firma antigua fallarán (401). Los nuevos eventos con el secret nuevo se procesarán con normalidad. No es necesario reprocesar eventos antiguos. |
| 2.5 | Verificar: desde Stripe Dashboard, enviar un evento de prueba al webhook y comprobar que responde 200. |

---

## 3. Base de datos (DATABASE_URL)

**Cuándo:** Rotación de contraseña del usuario de BD, cambio de host o de base de datos.

| Paso | Acción |
|------|--------|
| 3.1 | Crear el nuevo usuario/contraseña en el motor de BD (PostgreSQL) o actualizar la URL en el proveedor (ej. Render, Supabase). |
| 3.2 | Actualizar `DATABASE_URL` en el entorno (incluye usuario, contraseña, host, puerto y nombre de BD si cambian). |
| 3.3 | Reiniciar la API (y cualquier worker que use la misma `DATABASE_URL`). |
| 3.4 | **Efecto:** Las conexiones abiertas con la URL antigua fallarán. Tras el reinicio, la app usará la nueva URL. |
| 3.5 | Verificar: `GET /health` debe devolver `status: "ok"` y la API debe poder ejecutar consultas (ej. login, listar datos). |

**Importante:** Si cambias solo la contraseña del mismo usuario, asegúrate de que la nueva contraseña esté activa antes de detener la API con la antigua.

---

## 4. Otras variables sensibles

| Variable | Rotación |
|----------|----------|
| **REDIS_URL** | Cambiar en el proveedor, actualizar env y reiniciar API/workers. Verificar colas (BullMQ) tras el reinicio. |
| **AWS credentials / S3** | Rotar en IAM; actualizar `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (y región si aplica); reiniciar. |
| **SMTP (email)** | Actualizar `SMTP_USER`, `SMTP_PASS` si se rota la contraseña del correo; reiniciar. |
| **DIAN (Colombia)** | Certificado y/o `DIAN_SOFTWARE_PIN`: actualizar archivos y variables; reiniciar; probar envío en habilitación. |

---

## 5. Checklist post-rotación

- [ ] Variables actualizadas en el entorno (no en código).
- [ ] API (y workers) reiniciados.
- [ ] Health check OK: `GET /health`.
- [ ] Login y al menos una petición autenticada OK.
- [ ] Si se rotó Stripe: evento de prueba al webhook OK.
- [ ] Registrar en bitácora: fecha, secreto rotado, entorno.

---

**Última actualización:** Febrero 2026
