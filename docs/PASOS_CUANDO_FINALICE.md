# Pasos a seguir cuando el programa esté finalizado

> **Objetivo:** Qué hacer una vez que el desarrollo esté completo: verificación final, despliegue, puesta en producción y operación continua.

---

## Resumen rápido (checklist)

| Fase | Acción |
|------|--------|
| **1. Cierre de desarrollo** | Tests, variables de producción, documentación |
| **2. Despliegue** | API en Render, frontend en Vercel, Redis (Upstash) |
| **3. Puesta en marcha** | Crear primer usuario, CORS, verificar login y flujos |
| **4. Operación** | Backups, monitoreo, actualizaciones y (si aplica) DIAN real |

---

## 1. Cierre de desarrollo (antes de desplegar)

### 1.1 Verificación técnica

- [ ] **Tests:** Ejecutar tests desde la raíz: `npm test` (y en `apps/api`: tests E2E si los tienes).
- [ ] **Linting:** Sin errores en `apps/api` y `apps/web`.
- [ ] **Variables de entorno:** Revisar `env.example`; en producción **nunca** usar valores de ejemplo para `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` ni claves de terceros.
- [ ] **Migraciones:** Todas aplicadas; en producción se usará `npx prisma migrate deploy` (no `migrate dev`).

### 1.2 Documentación y código

- [ ] **README / GUIA_LEVANTAR_PROYECTO:** Actualizado con requisitos (Node, Docker, etc.).
- [ ] **Secrets:** Confirmar que `.env` y archivos con claves **no** estén en el repositorio (`.gitignore`).
- [ ] **DIAN:** Si el negocio requiere facturación electrónica real en Colombia, ver `docs/RECUENTO_PENDIENTES.md` (integración DIAN real: XML, firma, envío a API DIAN). Sin esto, el sistema funciona pero la facturación electrónica queda simulada.

---

## 2. Despliegue a la nube

Sigue la guía detallada: **`docs/DEPLOY_VERCEL_RENDER.md`**.

**Resumen:**

| Componente | Dónde | Qué hacer |
|------------|--------|-----------|
| **API (NestJS)** | [Render](https://render.com) | Conectar repo, configurar `render.yaml`, variables: `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `ALLOWED_ORIGINS`, `FRONTEND_URL`. |
| **Base de datos** | Render (PostgreSQL) | Creada por el Blueprint; migraciones con `migrate deploy` en el build. |
| **Redis** | [Upstash](https://upstash.com) | Crear base gratuita, copiar **Redis URL** → variable `REDIS_URL` en Render. |
| **Frontend (Next.js)** | [Vercel](https://vercel.com) | Importar repo, **Root Directory** = `apps/web`, variable `NEXT_PUBLIC_API_BASE_URL` = URL de la API en Render. |

Al terminar tendrás:

- **API:** `https://tu-api.onrender.com`
- **Frontend:** `https://tu-proyecto.vercel.app`

---

## 3. Puesta en marcha (primera vez en producción)

### 3.1 Crear el primer usuario

La base en Render viene sin usuarios. Opciones:

**A) Endpoint bootstrap (recomendado una sola vez)**

```bash
curl -X POST https://TU-API.onrender.com/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@tudominio.com\",\"password\":\"TuContraseñaSegura123!\"}"
```

Solo funciona si **no hay ningún usuario** en la base. Detalle: `docs/USUARIOS_PRODUCCION.md`.

**B) Seed desde tu PC (alternativa)**

En `DEPLOY_VERCEL_RENDER.md` se explica usar la **External Database URL** de Render y ejecutar el seed con `--force` una vez. Tras eso, no vuelvas a apuntar tu `.env` local a producción.

### 3.2 CORS y URL del frontend

En **Render** → servicio de la API → **Environment**:

- **ALLOWED_ORIGINS:** URL del frontend en Vercel (ej. `https://tu-proyecto.vercel.app`). Si tienes varias (preview, prod), sepáralas por coma.
- **FRONTEND_URL:** misma URL del frontend.

Guardar provoca un redeploy; tras eso el navegador podrá llamar a la API desde el frontend.

### 3.3 Verificación

1. Abrir la URL de Vercel → debe cargar la app.
2. Iniciar sesión con el usuario creado en 3.1.
3. Comprobar un flujo básico (por ejemplo: dashboard, una venta o listado).
4. Si la API estuvo inactiva (plan gratis Render), el primer request puede tardar ~1 minuto.

---

## 4. Operación continua

### 4.1 Backups

- **Render (PostgreSQL):** Revisar si tu plan incluye backups automáticos; si no, usar el endpoint de backups de la API o scripts con `pg_dump` (ver `docs/historico/BACKUPS_PRODUCCION.md`).
- **Datos críticos:** Definir periodicidad (diario/semanal) y dónde se guardan los respaldos.

### 4.2 Monitoreo y salud

- **Health:** `GET https://TU-API.onrender.com/health` (incluye DB, Redis, colas).
- **Métricas:** `GET /metrics` si está habilitado (observabilidad).
- Opcional: servicio de errores (ej. Sentry) para producción.

### 4.3 Actualizaciones

- **Código:** Al hacer push a la rama conectada, Render y Vercel despliegan automáticamente.
- **Migraciones:** Se aplican en el build de la API si el comando de build incluye `prisma migrate deploy`.
- **Dependencias:** Revisar periódicamente `npm audit` y actualizar dependencias con cuidado.

### 4.4 Usuarios adicionales

Cuando ya exista al menos un administrador, el resto de usuarios se crean desde la app (pantalla Usuarios) o con `POST /auth/users` usando el token de un admin. Ver `docs/USUARIOS_PRODUCCION.md`.

---

## 5. Opcional según tu caso

| Tema | Acción |
|------|--------|
| **Dominio propio** | En Vercel/Render configurar dominio custom y actualizar `ALLOWED_ORIGINS` y `FRONTEND_URL` (y en el frontend la URL de la API si aplica). |
| **Facturación electrónica DIAN real** | Implementar según `docs/RECUENTO_PENDIENTES.md` (XML UBL, firma, envío a API DIAN, CUFE, etc.). |
| **Plan de producción estable** | En Render, el plan gratuito “duerme” el servicio; para uso serio valorar plan de pago. |
| **Políticas y auditoría** | Ver `docs/AUDITORIA_Y_TRAZABILIDAD.md` y `docs/POLITICA_RETENCION_AUDITORIA.md` si necesitas cumplimiento formal. |

---

## Resumen de documentos útiles

| Documento | Para qué |
|-----------|----------|
| `GUIA_LEVANTAR_PROYECTO.md` | Levantar todo en local (desarrollo). |
| `DEPLOY_VERCEL_RENDER.md` | Despliegue paso a paso (Vercel + Render + Upstash). |
| `USUARIOS_PRODUCCION.md` | Crear y gestionar usuarios en producción. |
| `RECUENTO_PENDIENTES.md` | Pendientes (incluida DIAN real) y prioridades. |
| `ESTADO_ACTUAL_2026-01-28.md` | Estado actual del proyecto y checklist. |

---

**Última actualización:** Febrero 2026
