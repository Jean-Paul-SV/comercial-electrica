# Resiliencia y sincronización

**Autor:** Cloud Architect – Sistemas resilientes  
**Objetivo:** Que la aplicación sea **confiable** incluso ante fallos de internet o del sistema; que **el negocio no se detenga**.  
**Contexto:** Entornos reales con internet inestable (locales, zonas rurales, móviles).

**Necesidades:** Backups automáticos periódicos, exportación manual, funcionamiento offline parcial, sincronización al recuperar conexión.

---

## 1. Estrategia de backup

### 1.1 Situación actual

- **Backups automáticos:** Cron diario a las 2:00 AM (`BackupsService.scheduledBackup`), configurable con `AUTO_BACKUP_ENABLED`.
- **Creación:** `pg_dump` (o Docker como fallback) en formato custom (`-F c`), guardado en `BACKUP_DIR` (local).
- **Registro:** `BackupRun` con id, startedAt, finishedAt, status, storagePath, checksum.
- **Limpieza:** Se mantienen los últimos N backups (`MAX_BACKUPS_TO_KEEP`, default 30).
- **Verificación:** Checksum SHA-256 del archivo.
- **Manual:** POST `/backups` para crear backup bajo demanda.
- **Limitaciones:** Solo almacenamiento local; no hay copia off-site ni exportación descargable para el usuario.

### 1.2 Estrategia recomendada

| Aspecto | Recomendación |
|--------|----------------|
| **Frecuencia automática** | Mantener diario (2:00 AM). Opcional: backup incremental o cada 6 h si el negocio opera 24 h. |
| **Retención** | Mantener últimos N (ej. 30 días). Para cumplimiento fiscal (5 años), copiar backups críticos a almacenamiento inmutable (S3/Blob) con política de retención. |
| **Exportación manual** | Añadir **descarga** del backup: GET `/backups/:id/download` que sirva el archivo (o redirección a URL firmada) para que el usuario pueda guardar una copia en otro sitio (USB, otro servidor). |
| **Copia off-site** | Tras cada backup exitoso, **copiar** el archivo a un bucket S3/Google Cloud Storage/Azure Blob (misma región o otra para resiliencia). Configuración: `BACKUP_S3_BUCKET`, credenciales. Así un fallo del servidor no borra los backups. |
| **Verificación periódica** | Job semanal que verifique integridad (checksum) de los últimos backups y alerte si alguno falla. |
| **Backup antes de operaciones críticas** | Opcional: disparar un backup antes de migraciones o actualizaciones mayores (script o endpoint protegido). |

### 1.3 Exportación manual (entregable)

- **Backup completo (ya existe):** POST `/backups` → crea backup; añadir GET `/backups/:id/download` para descargar el `.sql` (o stream) con nombre legible `backup-YYYY-MM-DD.sql`. Solo usuarios autorizados (ADMIN).
- **Exportación de datos (nuevo):** Para “llevar datos” sin restaurar toda la BD, ofrecer **exportación por entidad** a CSV/Excel (ej. ventas, clientes, productos) en un rango de fechas. Endpoint ej. GET `/reports/export?entity=sales&from=...&to=...` con descarga de archivo. Útil cuando no hay conexión estable: exportar en un momento de conexión y trabajar con la hoja en otro equipo.

### 1.4 Resumen backup

- **Automático:** Diario, local + (recomendado) copia a nube.  
- **Manual:** Crear backup (POST) + **descargar** (GET download).  
- **Retención:** N últimos en local; políticas en nube para largo plazo.  
- **Verificación:** Checksum en creación + verificación periódica.

---

## 2. Arquitectura de sincronización

### 2.1 Objetivo

- **Funcionamiento offline parcial:** En momentos sin internet, el usuario puede seguir haciendo algo útil (consultar datos recientes, registrar ventas en cola) y, al recuperar conexión, **sincronizar** sin perder datos ni bloquear el negocio.
- **Sincronización al recuperar conexión:** Enviar al servidor las operaciones pendientes y refrescar datos locales.

### 2.2 Niveles de enfoque

| Nivel | Descripción | Esfuerzo | Beneficio |
|-------|-------------|----------|-----------|
| **A – Resiliencia de red** | Reintentos, timeout, detección de “sin conexión” en UI, mensajes claros. Sin cola offline. | Bajo | La app no “rompe” ante cortes breves; el usuario sabe qué pasa. |
| **B – Cola de escrituras + sync** | Las escrituras (venta, caja, etc.) se encolan en el cliente cuando falla la red y se reenvían al volver. Servidor idempotente por id de operación. | Medio | El negocio no pierde ventas ni movimientos por un corte. |
| **C – Offline-first parcial** | PWA + caché de datos (productos, clientes, catálogo) + cola de escrituras + sincronización bidireccional y resolución de conflictos. | Alto | Consultas y captura siguen funcionando sin conexión durante más tiempo. |

Recomendación: implementar **A** de entrada; luego **B** para las operaciones críticas (venta, cierre caja, gastos, movimientos de inventario); **C** si el negocio lo exige (puntos de venta en zonas sin cobertura).

### 2.3 Nivel A – Resiliencia de red

- **Reintentos:** En el cliente (fetch), reintentar la petición 2–3 veces con **backoff exponencial** (ej. 1 s, 2 s, 4 s) ante fallos de red (fetch rechazado, timeout, 5xx).
- **Timeout:** Timeout configurable (ej. 30 s) por petición; si se supera, considerar “sin conexión” y no colgar la UI.
- **Detección de conectividad:** `navigator.onLine` + escuchar eventos `online` / `offline`; opcionalmente un ping periódico a la API (GET `/health`).
- **UI:** Cuando `offline` o tras N fallos seguidos, mostrar **banner** “Sin conexión. Los datos pueden no estar actualizados. Se reintentará al recuperar la conexión.” No bloquear toda la pantalla; permitir seguir navegando con datos en caché (React Query mantiene caché).
- **No fallar en cascada:** Si una petición falla, no invalidar toda la sesión; solo la operación actual. El usuario puede reintentar manualmente (botón “Reintentar”).

### 2.4 Nivel B – Cola de escrituras y sincronización

- **Principio:** Cualquier **escritura** (POST/PATCH/DELETE) que falle por red se guarda en una **cola local** (IndexedDB o localStorage) con un id de operación (UUID). Al detectar que volvió la conexión, el cliente envía las operaciones pendientes en orden (o en paralelo si el servidor es idempotente).
- **Servidor idempotente:** Aceptar un header opcional `Idempotency-Key: <uuid>`. Si el servidor ya procesó esa clave, devolver el mismo resultado (200 con el recurso ya creado/actualizado) sin duplicar. Así un reintento no crea dos ventas.
- **Operaciones a encolar (prioridad):**  
  - Alta prioridad: crear venta, abrir/cerrar caja, crear movimiento de caja, gasto, movimiento de inventario.  
  - Media: crear/editar cliente, cotización, producto.  
  - Baja: editar categoría, etc.
- **Flujo:**  
  1. Usuario hace “Registrar venta”.  
  2. Cliente intenta POST `/sales` con `Idempotency-Key: uuid-1`.  
  3. Falla por red → guardar en cola: `{ id: uuid-1, method: 'POST', path: '/sales', body: {...}, createdAt }`.  
  4. Mostrar mensaje: “Venta guardada localmente. Se enviará al servidor cuando haya conexión.”  
  5. Al detectar `online` (o al abrir la app si ya está online), procesar cola: por cada ítem, reenviar la petición con el mismo `Idempotency-Key`.  
  6. Si el servidor responde 200/201, quitar de la cola. Si responde 4xx (validación), marcar como error y opcionalmente mostrar al usuario “Revisar pendientes”.  
  7. En la UI, una sección “Pendientes de enviar” (icono con badge de cantidad) que liste las operaciones en cola y permita reintentar o eliminar.

### 2.5 Nivel C – Offline-first parcial

- **PWA:** Service Worker que cachee estáticos y, si se desea, respuestas GET de catálogo (productos, clientes) con estrategia “network first, fallback cache”.
- **Caché de datos:** Sincronizar al inicio (o en background) productos activos, clientes, categorías en IndexedDB. En modo offline, las pantallas de venta y cotización leen de ahí.
- **Cola de escrituras:** Igual que B; al volver online, subir cola y luego refrescar caché con los últimos datos del servidor.
- **Conflictos:** Ver sección 3. Para datos maestros (producto, cliente), última escritura ganadora o merge por campo; para transacciones (venta, caja), no editar offline: solo crear; los conflictos serán “mismo Idempotency-Key” o “rechazo por regla de negocio” (ej. stock insuficiente en el servidor).

### 2.6 Diagrama de flujo (nivel B)

```
[Usuario: Registrar venta]
        ↓
[Cliente: POST /sales + Idempotency-Key]
        ↓
   ¿Red OK? ──No──→ [Guardar en cola local] → [Mostrar "Guardado localmente"]
        │
       Sí
        ↓
   [Servidor procesa] → 200 → [Mostrar éxito]
        ↓
   [Evento 'online'] → [Procesar cola: POST con mismo Idempotency-Key]
        ↓
   [Servidor: 200 ya procesado / 201 creado] → [Quitar de cola]
```

---

## 3. Manejo de conflictos de datos

### 3.1 Cuándo hay conflicto

- **Cola de escrituras (nivel B):** El “conflicto” es que el servidor rechaza la operación (ej. 409 Conflict, 422 por validación). Ej.: venta encolada con producto X y cantidad 5; al sincronizar, en el servidor el stock de X es 2 → el servidor devuelve error “stock insuficiente”. No hay dos versiones del mismo recurso; hay **operación rechazada**.
- **Offline-first (nivel C):** Dos fuentes modifican el mismo recurso: usuario A edita producto en el servidor y usuario B (o el mismo usuario en otro dispositivo) edita el mismo producto offline. Al sincronizar B, hay **conflicto de versión**: qué valor de precio/cantidad gana.

### 3.2 Estrategias recomendadas

| Escenario | Estrategia | Comentario |
|-----------|------------|------------|
| **Reintento con Idempotency-Key** | El servidor ya procesó la operación → devolver 200 con el recurso existente; el cliente quita de la cola y no duplica. | Evita duplicados (dos ventas iguales). |
| **Operación rechazada (validación/negocio)** | Servidor devuelve 4xx con mensaje (stock insuficiente, caja cerrada, etc.). El cliente marca la ítem de la cola como “error” y muestra al usuario: “No se pudo enviar: [mensaje]. Revisar y corregir o eliminar.” | El usuario debe corregir datos o dar de baja la operación pendiente. |
| **Conflicto de versión (mismo recurso editado)** | Usar **versión** en entidad (campo `version` o `updatedAt`). Al enviar PATCH, el servidor comprueba: si `version` del cliente ≠ actual en BD → 409 Conflict. Respuesta: “Otro cambio actualizó este registro. ¿Usar tus cambios (sobrescribir) o los del servidor (recargar)?” | Resolución manual para ediciones; para creaciones (venta, movimiento) no aplica si no se editan offline. |
| **Last-write-wins (LWW)** | Si no se usa versión, el último PATCH gana. Simple pero se pierden cambios del otro. Aceptable para datos poco críticos (ej. nombre de categoría). | No recomendado para precios, stock, ventas. |
| **Merge por campo** | Para entidades con muchos campos, merge: solo los campos que el usuario B editó offline se envían; si el servidor no los modificó en paralelo, se aplican. Si ambos modificaron el mismo campo, entonces 409 y resolución manual. | Requiere tracking de “qué campos editó B”. |

### 3.3 Reglas por tipo de entidad

- **Ventas, movimientos de caja, gastos, movimientos de inventario:** No se **editan** offline; solo se **crean**. No hay conflicto de edición; el único “conflicto” es rechazo por regla (stock, caja cerrada, etc.) → mostrar mensaje y dejar en “pendientes” para que el usuario corrija o elimine.
- **Productos, clientes, cotizaciones:** Si se permiten ediciones offline, usar **versión** y 409 con resolución manual (tu versión vs servidor) o merge por campo.
- **Cierre de caja:** Una sola vez por sesión; Idempotency-Key evita doble cierre. Si el servidor ya tiene la sesión cerrada, devolver 200 con el estado actual.

### 3.4 Resumen conflictos

- **Cola (B):** Idempotency-Key evita duplicados; errores 4xx → marcar pendiente como error y mostrar mensaje al usuario.  
- **Ediciones offline (C):** Versión + 409 + “¿Usar tus cambios o los del servidor?” o merge por campo.  
- **Transacciones:** Solo creación; conflictos = rechazo de negocio, no merge.

---

## 4. Entornos con internet inestable

### 4.1 Comportamiento recomendado

- **Timeouts cortos en escrituras críticas:** Ej. 15–30 s para POST venta; si hay timeout, guardar en cola y no dejar al usuario sin feedback (“Guardado localmente, se enviará cuando haya conexión”).
- **Reintentos automáticos:** 2–3 reintentos con backoff para GET; para POST, 1 reintento y luego cola si falla (evitar duplicados por múltiples reintentos sin Idempotency-Key).
- **Indicador de conexión visible:** Icono o texto en la barra: “Conectado” / “Sin conexión. Pendientes: N.” Así el usuario sabe si sus acciones se están enviando o quedan en cola.
- **No bloquear lectura:** Si hay datos en caché (React Query), mostrar aunque estén desactualizados y poner un aviso “Datos de hace X min. Actualizar cuando haya conexión.”
- **Exportación manual como respaldo:** En momentos de buena conexión, el usuario puede exportar ventas o clientes (CSV/Excel) como copia local; si luego hay corte prolongado, tiene al menos un respaldo descargado.

### 4.2 Backend

- **Health check ligero:** GET `/health` o `/` que responda rápido para que el cliente detecte “servidor vivo” sin cargar datos pesados.
- **Idempotency-Key:** Header opcional en POST/PATCH; el servidor guarda en caché (Redis o en memoria con TTL) “clave X → respuesta” por unos minutos; si llega otra petición con la misma clave, devolver la misma respuesta sin reejecutar la lógica. TTL ej. 24 h.
- **Graceful degradation:** Si Redis/cola falla, la API puede seguir funcionando sin cola (las escrituras se hacen síncronas); el cliente seguirá encolando localmente si la red falla.

---

## 5. Resumen de entregables

| Entregable | Contenido |
|------------|-----------|
| **Estrategia de backup** | Automático diario (local + copia off-site recomendada); retención N últimos; exportación manual: descarga del backup (GET download) + exportación por entidad (CSV/Excel); verificación por checksum y job periódico. |
| **Arquitectura de sincronización** | Nivel A: reintentos, timeout, detección offline, UI “sin conexión”. Nivel B: cola de escrituras en cliente, Idempotency-Key en servidor, procesar cola al volver online; operaciones críticas (venta, caja, gastos, inventario) encoladas. Nivel C: PWA + caché de catálogo + cola + sync. |
| **Manejo de conflictos** | Idempotency-Key para no duplicar; rechazos 4xx → marcar pendiente y mostrar mensaje; para ediciones offline: versión + 409 y resolución manual o merge por campo; transacciones solo creación, sin merge. |
| **Internet inestable** | Timeouts, reintentos con backoff, indicador de conexión, no bloquear lectura con caché, exportación manual como respaldo; backend: health check, soporte Idempotency-Key. |

Con esto la aplicación gana **resiliencia** ante fallos de internet o sistema: backups automáticos y exportación manual, funcionamiento parcial offline (cola de escrituras y, si se implementa, caché de datos) y sincronización al recuperar conexión, con manejo claro de conflictos y comportamiento pensado para entornos reales con internet inestable.
