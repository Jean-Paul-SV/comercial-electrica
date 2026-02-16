# Auditoría y trazabilidad completa

**Autor:** Arquitecto de Software – Sistemas regulados y auditoría  
**Objetivo:** Implementar un sistema de auditoría y trazabilidad **completo, inmutable y defendible** ante auditorías externas (DIAN, control interno).  
**Requisitos:** Registrar quién hizo qué, cuándo y desde dónde; historial inmutable de acciones críticas; capacidad de auditoría para DIAN y control interno.

---

## 1. Qué eventos deben auditarse

### 1.1 Principio

Auditar **todas las acciones que modifican datos de negocio o de seguridad** y **eventos de acceso/autenticación** relevantes para responsabilidad y cumplimiento.

### 1.2 Catálogo de eventos por entidad

| Entidad | Acción | Crítico DIAN / fiscal | Crítico control interno | Descripción |
|---------|--------|------------------------|--------------------------|-------------|
| **auth** | login | No | Sí | Inicio de sesión exitoso. |
| **auth** | login_failed | No | Sí | Intento de login fallido (seguridad). |
| **auth** | logout | No | Opcional | Cierre de sesión (si se implementa). |
| **user** | create | No | Sí | Alta de usuario (quién dio de alta). |
| **user** | update | No | Sí | Cambio de rol, desactivación. |
| **user** | delete / deactivate | No | Sí | Baja o desactivación de usuario. |
| **customer** | create | Sí* | Sí | Alta de cliente (datos fiscales). |
| **customer** | update | Sí* | Sí | Cambio de datos de cliente. |
| **customer** | delete | Sí* | Sí | Baja de cliente. |
| **product** | create | Sí* | Sí | Alta de producto (precios, IVA). |
| **product** | update | Sí* | Sí | Cambio de precio, categoría, activación. |
| **product** | delete / deactivate | Sí* | Sí | Baja o desactivación de producto. |
| **category** | create / update / delete | No | Sí | Cambio en catálogo. |
| **sale** | create | **Sí** | **Sí** | Venta registrada (base imponible, IVA). |
| **sale** | update / cancel | **Sí** | **Sí** | Anulación o modificación de venta. |
| **saleReturn** | create | **Sí** | **Sí** | Devolución (impacto fiscal). |
| **quote** | create / update | No | Sí | Cotización creada/modificada. |
| **quote** | convert | **Sí** | **Sí** | Conversión cotización → venta. |
| **quote** | status (expired, cancelled) | No | Sí | Cambio de estado. |
| **invoice** | create / update / void | **Sí** | **Sí** | Factura interna (número, totales). |
| **dianDocument** | sign / send / accept / reject | **Sí** | **Sí** | Eventos DIAN (envío, aceptación, rechazo). |
| **cashSession** | open | Sí* | **Sí** | Apertura de caja (monto inicial). |
| **cashSession** | close | Sí* | **Sí** | Cierre de caja (monto final, arqueo). |
| **cashMovement** | create | Sí* | **Sí** | Ingreso/egreso/ajuste de caja. |
| **expense** | create / delete | Sí* | **Sí** | Gasto registrado (caja). |
| **inventoryMovement** | create | Sí* | **Sí** | Entrada/salida/ajuste de inventario. |
| **supplier** | create / update / delete | No | Sí | Proveedores. |
| **purchaseOrder** | create / receive | No | Sí | Órdenes de compra. |
| **supplierInvoice** | create / update / payment | No | Sí | Facturas proveedor y pagos. |
| **backup** | create / verify / delete | No | Sí | Backups (integridad). |
| **dianConfig** | update | **Sí** | **Sí** | Cambio de configuración fiscal (resolución, ambiente). |

\* Relevante para cuadre fiscal y control interno; DIAN puede solicitar trazabilidad de ventas, caja e inventario.

**Resumen:**  
- **Crítico DIAN/fiscal:** ventas, facturas, documentos DIAN, caja, gastos, movimientos de inventario, clientes/productos que impactan facturación.  
- **Crítico control interno:** todo lo anterior + auth, usuarios, cotizaciones, proveedores, compras, backups.

### 1.3 Eventos que no se auditan (o solo en resumen)

- **Lecturas masivas** (listados, reportes): opcional auditar “acceso a reporte X” si hay datos sensibles; por defecto no registrar cada GET para no saturar.  
- **Lecturas de detalle** (un cliente, una venta): opcional “access” para datos muy sensibles; no obligatorio para todos los recursos.  
- **Health checks, métricas:** no van al log de auditoría de negocio.

---

## 2. Estructura de logs

### 2.1 Modelo actual (AuditLog)

Hoy tienes:

- `id`, `actorId`, `entity`, `entityId`, `action`, `diff` (Json), `createdAt`  
- Relación con `User` (actor).

**Limitaciones para trazabilidad completa y defensibilidad:**

- No se registra **desde dónde** (IP, user-agent).
- No hay **requestId** para correlacionar con logs de aplicación.
- No hay **severidad/categoría** para filtrar eventos críticos.
- No hay **tenantId** si en el futuro hay multi-tenant.
- No hay **integridad** (hash) para detectar alteraciones.
- `diff` puede ser muy grande; conviene política de qué incluir (evitar datos sensibles en texto plano si aplica).

### 2.2 Estructura recomendada (campos del registro de auditoría)

Cada registro de auditoría debe permitir responder: **quién, qué, cuándo, desde dónde, sobre qué recurso y qué cambió (si aplica)**.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| **id** | UUID | Sí | Identificador único del evento. |
| **actorId** | UUID (FK User) | No* | Usuario que realizó la acción. *Null si sistema o no identificado (ej. login fallido). |
| **entity** | string | Sí | Tipo de entidad (sale, customer, cashSession, auth, …). |
| **entityId** | string | Sí** | Id de la entidad afectada. **Para auth puede ser "unknown" o el userId. |
| **action** | string | Sí | create, update, delete, access, login, login_failed, etc. |
| **diff** | JSON | No | Cambios (old/new) o snapshot relevante. Evitar datos sensibles en texto plano. |
| **createdAt** | timestamp | Sí | Momento del evento (UTC recomendado). |
| **requestId** | string | No | Id de la petición HTTP para correlación con logs de app. |
| **ip** | string | No | IP del cliente (req.ip o X-Forwarded-For). |
| **userAgent** | string (limitado) | No | User-Agent del cliente (longitud máxima ej. 500). |
| **severity** | enum | No | critical, high, medium, low, info — para filtrar auditorías. |
| **category** | string | No | fiscal | security | operational | admin — para informes. |
| **tenantId** | UUID | No | Para multi-tenant; filtrar auditoría por negocio. |
| **hash** | string | No | Hash del registro anterior + este (cadena de integridad). |
| **summary** | string (corto) | No | Descripción legible para listados (ej. "Venta #123 creada"). |

**Severidad sugerida:**

- **critical:** eventos fiscales/DIAN (venta, factura, cierre caja, documento DIAN).  
- **high:** auth (login/logout), usuarios, caja (abrir/cerrar), gastos, inventario.  
- **medium:** clientes, productos, cotizaciones, proveedores, compras.  
- **low:** categorías, accesos opcionales.  
- **info:** eventos informativos.

**Categoría:**

- **fiscal:** ventas, facturas, DIAN, caja, gastos, inventario (lo que DIAN o control interno pueden pedir).  
- **security:** auth, usuarios.  
- **operational:** cotizaciones, devoluciones, órdenes de compra, facturas proveedor.  
- **admin:** backups, configuración DIAN, cambios de sistema.

### 2.3 Esquema Prisma sugerido (evolución del actual)

```prisma
model AuditLog {
  id        String   @id @default(uuid()) @db.Uuid
  actorId   String?  @db.Uuid
  entity    String
  entityId  String
  action    String
  diff      Json?
  summary   String?  @db.VarChar(500)
  severity  String?  @db.VarChar(20)   // critical | high | medium | low | info
  category  String?  @db.VarChar(20)   // fiscal | security | operational | admin
  requestId String? @db.VarChar(64)
  ip        String?  @db.VarChar(45)
  userAgent String?  @db.VarChar(500)
  tenantId  String?  @db.Uuid
  hash      String?  @db.VarChar(64)   // hash del evento anterior + este (chain)
  createdAt DateTime @default(now())

  actor  User?  @relation(fields: [actorId], references: [id])
  tenant Tenant? @relation(fields: [tenantId], references: [id])

  @@index([createdAt])
  @@index([entity, entityId])
  @@index([actorId])
  @@index([action])
  @@index([severity])
  @@index([category])
  @@index([tenantId])
  @@index([requestId])
}
```

Si no usas Tenant aún, puedes omitir `tenantId` y la relación; el resto aplica igual.

### 2.4 Contenido de `diff`

- **create:** datos mínimos necesarios para auditoría (ej. total, cliente, estado). Evitar copiar documentos completos.  
- **update:** `{ old: { campo1, campo2 }, new: { campo1, campo2 } }` solo campos relevantes (precio, cantidad, estado).  
- **delete:** snapshot mínimo del recurso eliminado (id, nombre, total si aplica).  
- **No incluir** en texto plano: contraseñas, tokens, datos de tarjeta. Para datos sensibles, indicar "[REDACTED]" o hash si se requiere prueba sin exponer.

---

## 3. Consideraciones legales y técnicas

### 3.1 Marco legal (Colombia / DIAN)

- **Facturación electrónica:** La DIAN exige conservar documentos y soportes que respalden las operaciones. Los logs de auditoría que vinculen ventas, facturas y documentos electrónicos forman parte del soporte de la operación.  
- **Retención:** Normativa tributaria colombiana suele exigir conservar información por **5 años** (ver normativa vigente). Los logs de auditoría vinculados a operaciones fiscales deben conservarse al menos ese plazo.  
- **Inmutabilidad:** Para que el registro sea defendible, debe ser **tamper-evident**: no modificable ni eliminable por usuarios normales; idealmente con integridad verificable (hash en cadena o firma).  
- **Acceso:** Solo roles autorizados (ej. ADMIN, auditor) deben poder consultar logs; el acceso mismo puede auditarse (quién consultó auditoría y cuándo).

### 3.2 Control interno

- **Segregación de funciones:** El sistema ya registra quién hace cada acción; la auditoría permite revisar si una misma persona abre caja, registra ventas y cierra caja (política de negocio).  
- **Trazabilidad de cambios:** Cualquier cambio en ventas, facturas, caja o inventario debe quedar registrado con quién, cuándo y qué cambió (diff).  
- **Accesos fallidos:** Los intentos de login fallidos (ya los registras) son base para detección de abusos.

### 3.3 Consideraciones técnicas

- **Origen del contexto (quién, desde dónde):**  
  - **actorId:** Tomar del JWT (req.user.sub) en cada request; pasarlo al AuditService.  
  - **ip / userAgent / requestId:** Extraer de la petición HTTP en un interceptor o middleware y pasarlos al servicio de auditoría (o inyectar un “AuditContext” por request).  
- **Zona horaria:** Guardar `createdAt` en **UTC**; en la UI mostrar en zona horaria del negocio.  
- **Inmutabilidad:**  
  - **Aplicación:** No exponer APIs de actualización ni borrado de AuditLog.  
  - **Base de datos:** Tabla sin UPDATE/DELETE desde la app; permisos de solo INSERT y SELECT para la app.  
  - **Opcional:** Cadena de hash (cada registro incluye hash del anterior + contenido de este) para detectar alteraciones incluso a nivel BD.  
- **Datos sensibles:** No guardar contraseñas ni tokens en `diff`; para campos sensibles usar redacción o hash.  
- **DIAN:** Mantener `DianEvent` para eventos de facturación electrónica (envío, aceptación, rechazo); el AuditLog puede referenciar el mismo hecho con entity=dianDocument, entityId=id, action=send, y diff con resumen (número, CUFE, estado). Así tienes trazabilidad unificada y detalle DIAN en su tabla.

---

## 4. Impacto en rendimiento

### 4.1 Situación actual

- Inserción **síncrona** en cada operación (logCreate, logUpdate, logDelete). Si la BD o el AuditService fallan, hoy solo se hace console.error y no se falla la petición; por tanto el impacto en latencia es el tiempo de un INSERT por acción.

### 4.2 Riesgos

- **Pico de tráfico:** Muchas operaciones simultáneas implican muchos INSERTs en AuditLog; la tabla puede crecer rápido y los índices pueden afectar escritura.  
- **Latencia:** Cada request hace al menos un INSERT extra; en BD lenta puede sumar unos ms por petición.

### 4.3 Recomendaciones

| Medida | Descripción |
|--------|-------------|
| **Cola asíncrona** | Enviar el evento de auditoría a una cola (Bull/BullMQ, ya usas en el proyecto) y que un worker persista en AuditLog. La petición de negocio no espera al INSERT. Riesgo: si la cola cae, eventos pueden perderse hasta que se recupere; para eventos críticos fiscales puede valorarse cola persistente + reintentos. |
| **Batch insert** | El worker puede agrupar eventos (ej. cada 1–2 s o N eventos) y hacer INSERT en lote para reducir round-trips a la BD. |
| **Índices justos** | Mantener índices por createdAt, entity+entityId, actorId, action; evitar índices que no uses en consultas de auditoría. |
| **Particionado (futuro)** | Si la tabla crece mucho (millones de filas), particionar por fecha (ej. por mes) para mantener consultas y archivado manejables. |
| **Retención y archivado** | Política de retención: ej. 5 años en línea para eventos fiscales; el resto puede archivarse a frío (export a objeto almacenado) y borrarse de la tabla operativa para no degradar rendimiento. |
| **No bloquear la operación** | Si el log falla (cola caída, BD llena), no fallar la venta ni la operación crítica; registrar el fallo en logs de aplicación y reintentar o alertar. |

### 4.4 Compromiso

- **Máxima defensibilidad:** escritura síncrona, con hash en cadena y sin cola (no se pierde ningún evento).  
- **Máximo rendimiento:** cola asíncrona + worker; aceptar pequeño riesgo de pérdida de eventos si la cola falla.  
- **Recomendación:** Para eventos **fiscales/críticos** (venta, factura, cierre caja, documento DIAN), considerar escritura **síncrona** o cola con garantía de entrega y reintentos; para el resto, cola asíncrona es aceptable si la política de negocio lo permite.

---

## 5. Sistema defendible ante auditorías externas

### 5.1 Principios

- **Inmutabilidad:** Los registros no se editan ni se borran por la aplicación.  
- **Integridad verificable:** Opcional pero recomendable: cadena de hash (cada registro incluye hash del anterior + contenido propio) para detectar alteraciones.  
- **Trazabilidad completa:** Quién (actorId), qué (entity, entityId, action), cuándo (createdAt UTC), desde dónde (ip, userAgent), y qué cambió (diff) cuando aplique.  
- **Retención documentada:** Política escrita de retención (ej. 5 años para datos fiscales) y archivado.  
- **Control de acceso:** Solo roles autorizados pueden leer auditoría; el acceso a la consulta de logs puede auditarse también.

### 5.2 Cadena de integridad (hash chain)

Para hacer el log **tamper-evident**:

1. Al insertar el evento N, calcular:  
   `hash(N) = H(hash(N-1) || id || entity || entityId || action || createdAt || hash(diff))`  
   donde H es una función criptográfica (SHA-256). El primer evento usa un valor fijo o “genesis” como hash(N-1).  
2. Guardar `hash` en el registro N.  
3. En cualquier momento, un proceso puede recorrer la tabla por orden de creación y verificar que cada hash coincide; si alguien modifica o borra un registro, la cadena se rompe.

Requisitos: orden de inserción estable (por ejemplo, por createdAt y id). Si usas cola asíncrona, el worker debe insertar en orden o asignar un “sequence” interno para calcular el hash en orden.

### 5.3 Retención y archivado

- **Política recomendada:**  
  - Eventos **fiscales/críticos:** retención mínima **5 años** en línea (o archivados en almacenamiento inmutable).  
  - Resto: ej. 2 años en línea y después archivar o eliminar según política.  
- **Archivado:** Export periódico (ej. mensual) de AuditLog a archivos (CSV/JSON) o a un bucket S3/Blob con versión y sin borrado; conservar checksum.  
- **Documentar** la política en un documento de “Retención y auditoría” interno.

### 5.4 Consulta y exportación para auditores

- **Filtros:** Por rango de fechas, entidad, actor, acción, severidad/categoría.  
- **Exportación:** Permitir exportar resultados de búsqueda a CSV/Excel (solo usuarios autorizados) para entregar a DIAN o auditoría interna.  
- **Auditoría de la auditoría:** Registrar quién consultó el módulo de auditoría y qué filtros usó (evento tipo “audit_log_access”) para trazabilidad de acceso a datos sensibles.

---

## 6. Resumen de entregables

| Entregable | Contenido |
|------------|-----------|
| **Eventos a auditar** | Catálogo por entidad y acción; identificación de eventos críticos para DIAN y control interno. |
| **Estructura de logs** | Campos: id, actorId, entity, entityId, action, diff, createdAt, requestId, ip, userAgent, severity, category, tenantId, hash, summary; esquema Prisma sugerido. |
| **Consideraciones legales** | Retención 5 años para datos fiscales; inmutabilidad; no modificar/borrar logs; acceso restringido. |
| **Consideraciones técnicas** | Origen de contexto (request); UTC; hash chain opcional; no guardar datos sensibles en diff; relación con DianEvent. |
| **Rendimiento** | Cola asíncrona + worker recomendable para la mayoría; escritura síncrona o cola fiable para eventos fiscales; batch, índices, retención y archivado. |
| **Defensibilidad** | Inmutabilidad, cadena de hash opcional, política de retención documentada, control de acceso a la consulta, exportación para auditores. |

Con esto el sistema de auditoría queda **confiable y defendible** ante auditorías externas (DIAN y control interno), con trazabilidad completa de quién hizo qué, cuándo y desde dónde, e historial inmutable de acciones críticas.
