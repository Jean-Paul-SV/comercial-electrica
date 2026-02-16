# Runbook: Operación (monitor, alertas, backup restore)

> **Objetivo:** Mantener el servicio estable y recuperable. Incluye monitorización, alertas mínimas y prueba de restauración de backups.  
> **Quién:** Operaciones o DevOps.  
> **Referencia:** `HARDENING_TECNICO_PRODUCCION.md`, `AUDITORIA_CTO_HARDENING_FEB2026.md`.

---

## 1. Monitor (health check)

### 1.1 Endpoint a vigilar

- **URL:** `GET https://<tu-dominio-api>/health`  
- **Cuerpo esperado (ej.):** `{ "status": "ok", "database": "connected", ... }`  
- **Código esperado:** `200`

### 1.2 Configuración recomendada

Usar un monitor externo que haga una petición cada **1–2 minutos**:

| Herramienta | Configuración típica |
|-------------|----------------------|
| **UptimeRobot** | Monitor HTTP(s), intervalo 5 min (plan gratis) o 1 min (de pago). Alerta por email/Slack si no responde o status ≠ 200. |
| **Pingdom** | HTTP check cada 1 min. Alertas por email/SMS. |
| **Render / Railway / propio orquestador** | Usar el health check nativo del servicio (si existe) apuntando a `/health`. |

### 1.3 Criterios de alerta

- **Crítico:** El endpoint no responde (timeout, ej. 10 s) o devuelve código distinto de 200.
- **Crítico:** El JSON incluye `"status": "error"` o `"database": "disconnected"`.
- Opcional: alertar si el tiempo de respuesta es > 5 s de forma persistente.

### 1.4 Acción ante alerta

1. Comprobar estado del proveedor (Render, VPS, etc.): reinicios, incidentes.
2. Revisar logs de la API (últimos errores 5xx, excepciones).
3. Comprobar conectividad a base de datos y Redis (si aplica).
4. Si es necesario: reiniciar la API y volver a comprobar `/health`.

---

## 2. Alertas mínimas recomendadas

| Alerta | Umbral / Condición | Acción |
|--------|--------------------|--------|
| **Health check fallido** | Monitor externo: no 200 o timeout. | Ver §1.4. |
| **Tasa 5xx elevada** | Si tienes métricas (ej. log aggregator): > 1% de respuestas 5xx en 5 min. | Revisar logs, posibles bugs o dependencias caídas. |
| **Cola con muchos fallos** | Si usas BullMQ y un dashboard: cola con > 10 jobs en estado `failed` sin reintento. | Revisar workers, logs de jobs fallidos. |
| **Disco / memoria** | Si el servidor reporta disco lleno o memoria alta. | Limpiar logs/archivos temporales; escalar o optimizar. |

Sin herramienta de métricas aún, el **monitor de health check** (§1) es el mínimo imprescindible.

---

## 3. Prueba de restauración de backup

**Objetivo:** Asegurarse de que los backups se pueden restaurar. Se recomienda hacerlo **al menos una vez al mes** en un entorno de staging (no producción).

### 3.1 Requisitos

- Tener un backup reciente (generado por la API con `POST /backups` como platform admin, o por cron/job programado).
- Entorno de staging con PostgreSQL (puede ser una copia vacía o una BD de prueba).

### 3.2 Pasos (restore manual con pg_restore)

| Paso | Acción |
|------|--------|
| 3.1 | Descargar el archivo de backup (desde el almacenamiento configurado: disco local o S3). |
| 3.2 | En el servidor de staging (o local), tener instalado `pg_restore` (viene con cliente PostgreSQL). |
| 3.3 | Crear una base de datos vacía para la prueba: `createdb comercial_electrica_restore_test`. |
| 3.4 | Ejecutar: `pg_restore -d comercial_electrica_restore_test -F c backup-YYYY-MM-DD.dump` (ajustar nombre del archivo). Si hay errores de “already exists”, suelen ser por objetos de extensión; a menudo se pueden ignorar si el esquema y datos críticos están. |
| 3.5 | Comprobar: conectar a `comercial_electrica_restore_test` y ejecutar consultas de prueba (ej. `SELECT COUNT(*) FROM "User";`, `SELECT COUNT(*) FROM "Tenant";`). |
| 3.6 | Documentar: fecha de la prueba, archivo usado, resultado (OK / fallos menores). |
| 3.7 | Eliminar la BD de prueba si no la necesitas: `dropdb comercial_electrica_restore_test`. |

### 3.3 Calendario sugerido

- **Frecuencia:** Mensual (ej. primer lunes del mes).
- **Responsable:** Asignar a una persona del equipo.
- **Registro:** Anotar en una hoja o wiki: “Restore test – [fecha] – OK / incidencias”.

---

## 4. Verificación de migraciones (staging y producción)

Antes de cada despliegue que incluya cambios de esquema, o al menos en cada release:

| Paso | Acción |
|------|--------|
| 4.1 | En el servidor del entorno (staging o producción): `cd apps/api && npx prisma migrate status`. |
| 4.2 | Si hay migraciones pendientes: `npx prisma migrate deploy`. No usar `migrate dev` en staging/producción. |
| 4.3 | Comprobar que la API arranca y que `GET /health` responde OK. |

Ver también: `docs/VERIFICACION_MIGRACIONES.md` (creado en este proyecto).

---

## 5. Resumen de tareas recurrentes

| Tarea | Frecuencia | Doc |
|-------|------------|-----|
| Revisar que el monitor de health esté activo | Semanal | §1 |
| Revisar alertas (email/Slack) | Diario o según configuración | §2 |
| Prueba de restore de backup | Mensual | §3 |
| Verificar migraciones antes/después de deploy | Por despliegue | §4 |

---

**Última actualización:** Febrero 2026
