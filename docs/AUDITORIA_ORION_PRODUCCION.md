# Auditoría Orion — Sistema de gestión y facturación DIAN

**Alcance:** API REST (NestJS), Prisma, colas BullMQ, módulo DIAN, multi-tenant/SaaS, seguridad y visión de producto.  
**Objetivo:** Detectar fallos, riesgos, mejoras de rendimiento y brechas funcionales antes de producción real (Colombia).

---

## 1. Testeo completo del sistema

### 1.1 API REST (endpoints, DTOs, validaciones, errores HTTP)

| Qué probar | Cómo | Riesgo en producción |
|------------|------|------------------------|
| **DTOs y validación** | Requests con campos inválidos, tipos incorrectos, `forbidNonWhitelisted` (ya activo). Probar arrays vacíos en `items` de ventas/cotizaciones. | 400 con mensajes claros; asegurar que no se filtre solo por whitelist y queden campos “extra” ignorados sin aviso si el contrato cambia. |
| **Paginación** | `page=0`, `limit=0`, `limit=10000` en listados (sales, quotes, customers, audit, etc.). | División por cero, timeouts o respuestas gigantes. Validar `limit` max (ej. 100) en DTOs. |
| **UUIDs** | `ParseUUIDPipe` en params; IDs mal formados o de otro tenant. | 400 para UUID inválido; 404 para recurso no encontrado sin revelar existencia en otro tenant (ya bien manejado en DIAN/sales). |
| **Errores HTTP** | `AllExceptionsFilter` + Prisma: P2002, P2025, P2003, P2034. Probar conflictos de unicidad, FK rotas, deadlocks. | Respuestas consistentes (409, 404, 400, 503); en prod no exponer `meta` de Prisma en detalles. |
| **Tenant aislado** | Por recurso: listar/crear con JWT de tenant A, intentar acceder a ID de tenant B. | Filtro `tenantId` en todos los servicios; el interceptor de tenant rellena `req.user.tenantId` cuando falta. |

**Recomendación:** Tests e2e por dominio (sales, quotes, inventory, dian, audit) con tenant fijo y otro tenant aislado; tests de validación con DTOs inválidos.

---

### 1.2 Swagger (claridad, consistencia, contratos)

- **Estado:** DocumentBuilder con tags (auth, catalog, sales, dian, etc.), Bearer JWT, versión 1.0.
- **Gaps:**
  - Muchos controladores no exponen `@ApiResponse` para 400/401/403/404; los DTOs no siempre tienen `@ApiProperty` con `example`/`description`.
  - Contrato DIAN: `getDocumentStatus` devuelve `status` con enum que incluye `PROCESSING`; en schema Prisma el enum es `DRAFT | SIGNED | SENT | ACCEPTED | REJECTED` (no hay `PROCESSING`). Unificar con el modelo real.
  - No hay documento de “primera llamada” (login → token → tenant) para onboarding de integradores.

**Qué podría fallar:** Integradores que asumen códigos de estado o formatos no documentados; cambios de contrato sin reflejar en Swagger.

---

### 1.3 Autenticación y autorización

| Qué probar | Cómo | Riesgo |
|------------|------|--------|
| **Login** | Credenciales correctas, incorrectas, usuario inactivo, throttle (50/min). Con `THROTTLE_LOGIN_DISABLED=true` en prod si el contador no resetea. | 429 persistente; bloqueo por IP compartida (NAT). |
| **JWT** | Token expirado, mal formado, firma inválida, sin `tenantId` (usuario platform admin o token antiguo). | Interceptor rellena `tenantId` vía `TenantModulesService.getEffectiveTenantId`; endpoints que exigen tenant deben rechazar con 403. |
| **Permisos** | `RequirePermission('dian:manage')`, `RequireModule('electronic_invoicing')`: usuario sin permiso o sin módulo. | 403; no revelar si el recurso existe. |
| **Platform admin** | Usuario con `tenantId === null`: no debe ver recursos de un tenant concreto; lista de usuarios no debe incluirlo. | Filtro en provider/list-users y en front; guards que rechacen acceso a recursos de tenant si es platform admin. |

**Flujo transaccional (venta → DIAN → estados):** Crear venta con `cashSessionId` válido → se crea Sale, Invoice, DianDocument en una transacción serializable → se encola job `dian/send` con `dianDocumentId`. El worker procesa: generar XML → firmar → enviar (hoy simulado) → actualizar estado y opcionalmente PDF. Probar: venta exitosa; venta con sesión cerrada (400); venta sin stock (400); fallo en worker (reintentos BullMQ 10 intentos, backoff exponencial 5s).

---

### 1.4 Integridad de base de datos (Prisma)

- **Transacciones:** `createSale` usa `$transaction` con `Serializable` para Sale + Invoice + DianDocument + movimientos de caja e inventario; correcto.
- **Índices:** Schema tiene buenos índices en `tenantId`, `(tenantId, number)`, `status`, `createdAt`, etc. en tablas críticas (Sale, Quote, Invoice, DianDocument, AuditLog).
- **Riesgos:**
  - Doble encolado DIAN: si por bug o retry se llama dos veces `dianQueue.add('send', { dianDocumentId })` para el mismo documento, se procesan dos jobs; no hay idempotencia por `dianDocumentId` en la cola. Recomendación: `jobId: dianDocumentId` (o `dian-${dianDocumentId}`) en `add()` para que BullMQ dedupe.
  - `DianConfig` existe por tenant pero `DianService.getDianConfig()` usa solo env global; en multi-tenant real habría que leer por `tenantId` (y certificado/softwareId por tenant si aplica).

---

### 1.5 Colas (BullMQ)

| Aspecto | Estado | Acción |
|---------|--------|--------|
| **Reintentos** | `attempts: 10`, `backoff: { type: 'exponential', delay: 5000 }` en `sales.service` al encolar. | Aceptable; vigilar que 10 intentos no saturen DIAN si hay error persistente. |
| **Idempotencia** | No hay `jobId` al añadir el job; mismo documento puede encolarse dos veces. | Usar `jobId: dianDocumentId` (o compuesto con tenant si se quisiera) en `dianQueue.add()`. |
| **Fallos** | Processor hace `throw error` y BullMQ reintenta; en tests se evita reintentar si documento no encontrado. | Definir política de dead-letter o alerta tras N fallos (ej. 10) para revisión manual. |
| **Redis** | `maxRetriesPerRequest: null` en queue module para evitar desconexiones con Redis inestable (ej. Upstash). | Correcto; asegurar REDIS_URL en prod y monitoreo de Redis. |

---

### 1.6 Errores críticos (timeouts, rechazos DIAN)

- **Timeouts:** No hay timeout explícito en `sendToDian()` (aún simulado). Cuando se implemente HTTP a DIAN, usar `timeout` (ej. 30s) y reintentos con backoff; no dejar la conexión colgada.
- **Rechazos DIAN:** `handleDianResponse` actualiza estado a REJECTED, guarda `lastError`, crea DianEvent y audit; correcto. Falta: no hay reintento automático “corregir y reenviar” (cambios de XML/resolución); hoy es manual.
- **Manejo en worker:** Si `processDocument` lanza, el documento queda en REJECTED y el job falla (reintentos); tras agotar intentos el job queda en failed. No se actualiza documento a un estado tipo “FAILED_AFTER_RETRIES”; podría ser útil para reportes.

---

## 2. Revisión de arquitectura

### 2.1 Escalabilidad multi-empresa

- **Modelo de datos:** Tenant en todas las tablas de negocio; `User.tenantId` nullable para platform admin. Bien para multi-tenant por fila.
- **Aislamiento:** Servicios reciben `tenantId` del contexto (JWT o interceptor); consultas filtran por `tenantId`. Riesgo: algún endpoint nuevo que no reciba o no filtre por tenant.
- **DianConfig:** Por tenant en BD; el servicio DIAN hoy usa solo env. Para SaaS real: configuración por tenant (softwareId, certificado, ambiente) desde BD o secret store por tenant.

### 2.2 Desacoplamiento

- **DIAN:** Servicio con `processDocument`, `generateXML`, `signDocument`, `sendToDian`, `handleDianResponse`, `generatePDF`. Envío real y PDF están en TODOs; dependencia de env/certificado global. Bien separado del dominio de ventas; la venta solo encola el job.
- **Colas:** QueueModule registra colas `dian`, `backup`, `reports`; el processor solo conoce `DianService`. Correcto.
- **Auth:** JwtStrategy devuelve payload; PermissionsGuard + ModulesGuard + RequirePermission/RequireModule; TenantContextInterceptor rellena tenantId. Responsabilidades claras.

### 2.3 Buenas prácticas NestJS

- Módulos por dominio (auth, sales, dian, reports, etc.); PrismaService inyectado; ConfigService para env; filtros globales y pipes de validación.
- Mejora: algunos servicios son muy grandes (p. ej. ReportsService); extraer “handlers” por tipo de reporte o usar casos de uso por archivo para mantener testabilidad.

### 2.4 Crecimiento a SaaS sin reescrituras

- Planes, PlanFeature, TenantModule, Subscription, Stripe ya modelados. Control de acceso por módulo (`RequireModule`) y por permiso.
- Falta: límites por plan (ej. N facturas/mes, N usuarios) no implementados en código; solo modelo de datos. Para ser vendible habría que aplicar límites en creación de ventas/facturas/usuarios y en UI.
- Propuesta: capa “entitlements” que consulte plan + uso actual y rechace o permita la operación.

---

## 3. Optimización de rendimiento

### 3.1 Prisma (índices, N+1, transacciones)

- **Índices:** Ya hay índices en tenantId, status, fechas en tablas principales. Revisar consultas de reportes con `soldAt`/`issuedAt` en rangos; asegurar índices compuestos si hay filtros frecuentes (ej. `(tenantId, soldAt)`).
- **N+1:** En `listSales` se usa `include: { items: { include: { product: true } }, customer, invoices, createdBy }` en un solo `findMany`; correcto. En ReportsService hay muchas `findMany` secuenciales (dashboard, reportes complejos); donde sea posible agrupar en `Promise.all` o reducir rondas (ya se hace en varios sitios).
- **Transacciones:** Ventas con Serializable; reportes son lectura. Evitar transacciones largas de solo lectura; usar lecturas simples.

### 3.2 Memoria y CPU

- **XML/PDF:** Generación de XML por documento es string concatenation; aceptable. PDF aún no implementado; cuando se haga, evitar cargar plantillas pesadas en cada request; reutilizar instancias o workers dedicados si hay picos.
- **Cola DIAN:** Un job por documento; si hay pico de ventas, muchos jobs; Redis y worker aguantan. Opción: limitar concurrencia del worker (BullMQ `concurrency`) para no saturar DIAN o el servidor.

### 3.3 Serialización / archivos

- **XML:** Se construye en memoria y se pasa a firma y “envío”; no se escribe a disco en el flujo actual (solo `xmlPath` simulado). En producción podría guardarse en storage (S3/local) por tenant para trazabilidad y reenvío.
- **Certificado .p12:** Se lee de disco en cada firma (`loadCertFromP12`); si hay muchos documentos seguidos, considerar cache en memoria del par clave/cert (con cuidado de no loguear ni exponer).

---

## 4. Seguridad

### 4.1 Credenciales DIAN

- **Riesgo:** `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN`, `DIAN_CERT_PASSWORD` en env; en código se leen con ConfigService. Si el .env se sube o se loguea, fuga total.
- **Medidas:** Nunca loguear env con secretos; en producción usar gestor de secretos (AWS Secrets Manager, Vault, Render secret files). Rotar PIN y certificado según política DIAN; no hardcodear en código.

### 4.2 Certificados digitales

- `DIAN_CERT_PATH` apunta a .p12; el archivo debe estar en un volumen seguro y no estar en el repo. Contraseña del .p12 solo en variable o secret manager.
- En multi-tenant real, cada tenant podría tener su propio certificado; hoy es uno global. Almacenamiento de .p12 por tenant: storage encriptado y acceso solo cuando se procese un documento de ese tenant.

### 4.3 Variables de entorno

- `validateEnv` exige DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET; en prod JWT_REFRESH_SECRET. ALLOWED_ORIGINS recomendado en prod (main.ts ya exige en prod que no esté vacío si se usa CORS estricto).
- DIAN_* no validadas al arranque; el servicio avisa con warn si faltan. Opción: en prod fallar si DIAN está “habilitado” y faltan softwareId/softwarePin.

### 4.4 Tokens y sesiones

- JWT con sub, email, role, tenantId, isPlatformAdmin; exp según JWT_ACCESS_TTL_SECONDS. No hay refresh flow expuesto en esta revisión en detalle; asegurar que refresh no extienda indefinidamente sin re-autenticación.
- Throttle de login por IP; buena práctica. THROTTLE_LOGIN_DISABLED solo para emergencias.

### 4.5 Riesgos comunes

- **Inyección:** Prisma parametriza queries; no hay SQL crudo. Validación con class-validator en DTOs; whitelist en ValidationPipe.
- **Fuga de datos:** Respuestas 404 genéricas; en DIAN se usa “documento no encontrado” sin revelar si es de otro tenant. Revisar que ningún listado ni detalle filtre mal y muestre datos de otro tenant.
- **Logs sensibles:** AllExceptionsFilter no envía al cliente stack ni detalles Prisma en prod; correcto. Asegurar que DIAN_CERT_PASSWORD y XML firmados no entren en logs.

---

## 5. Facturación DIAN (visión real)

### 5.1 Qué falta para habilitación

| Componente | Estado | Pendiente |
|------------|--------|-----------|
| Envío real | Simulado en `sendToDian()` | HTTP a API DIAN (habilitación/producción), autenticación con softwareId/softwarePin, manejo de timeouts y reintentos. |
| CUFE | Mock en respuesta | Recibir CUFE real en respuesta DIAN y persistirlo. |
| PDF | Ruta simulada | Generar PDF con plantilla, QR, CUFE; guardar en storage; opcionalmente enviar por email. |
| Consulta estado | Estado en BD | Consulta a DIAN de estado de documento (si la API lo ofrece) para reconciliar. |
| Config por tenant | En BD (DianConfig) | DianService debe usar DianConfig por tenant (softwareId, pin, cert, ambiente) en lugar de solo env global. |

### 5.2 Riesgos comunes con la DIAN

- **Rechazos por formato:** XML no conforme al anexo técnico (UBL 2.1, perfiles DIAN). Validar esquema/XSD antes de enviar (herramientas o librería).
- **Certificado vencido o revocado:** Falla la firma o DIAN rechaza. Monitorear vencimiento y rotar antes de que caduque.
- **Numeración:** Resolución, prefijo, rango; no duplicar números ni saltar. Hoy el número de factura es `makeInvoiceNumber()` con fecha + random; en producción debe alinearse con resolución y rango autorizado por tenant.
- **Ambiente:** Habilitación vs producción; no mezclar; usar DIAN_ENV y endpoints correctos.

### 5.3 Errores típicos (XML / firma / envío)

- **XML:** Caracteres especiales sin escapar; nodos obligatorios faltantes; decimales con coma en lugar de punto; fechas/horas en formato incorrecto. `escapeXml` existe; revisar todos los campos que se insertan.
- **Firma:** Algoritmo (RSA-SHA256), C14N, transform enveloped; ya configurado con xml-crypto. Problemas: certificado incorrecto, contraseña errónea, nodo firmado no coincide con el que espera DIAN.
- **Envío:** Timeout, 503 DIAN, respuesta mal formada. Implementar reintentos con backoff y marcar documento en estado “reintentando” o “error temporal”.

### 5.4 Validaciones antes de enviar

- Validar que el documento esté en estado DRAFT o SIGNED (no reenviar ACCEPTED).
- Validar que Invoice tenga número, fechas, totales coherentes con ítems.
- Validar que cliente tenga docType/docNumber si es obligatorio para FE.
- Opcional: validar XML contra XSD de DIAN antes de firmar.

### 5.5 Rechazos y reintentos

- Rechazo definitivo (ej. formato inválido): estado REJECTED, lastError, DianEvent; no reintentar automáticamente el mismo XML.
- Rechazo temporal (ej. servicio DIAN no disponible): mantener en SENT o nuevo estado “PENDING_RETRY” y dejar que BullMQ reintente; tras N fallos pasar a REJECTED o “FAILED_RETRIES” para revisión manual.

---

## 6. Visión de producto (Orion como software comercial)

### 6.1 Qué le falta para ser vendible

- **Facturación DIAN real:** Envío, CUFE real, PDF, consulta estado (ver §5).
- **Límites por plan:** Aplicar en backend y UI (facturas/mes, usuarios, almacenes, etc.) según PlanFeature y uso actual.
- **Onboarding y alta de tenant:** Flujo claro (registro, activación, configuración DIAN por tenant, primer usuario).
- **Soporte y documentación:** Guía de integración, códigos de error, runbooks (ya hay algunos en docs).
- **Facturación recurrente:** Stripe ya integrado; asegurar que suscripciones y cambios de plan se reflejen en permisos y límites.

### 6.2 Módulos a corto y mediano plazo

- **Corto:** DIAN producción (envío, CUFE, PDF); notificaciones (email factura al cliente); dashboard de estado de documentos DIAN por tenant.
- **Mediano:** Límites por plan y pantalla de uso; multi-almacén si aplica; reportes fiscales (libro de ventas, etc.); integración contable (exportación o API).

### 6.3 Automatizar vs manual

- **Automatizar:** Envío a DIAN tras venta; reintentos con backoff; generación de PDF al aceptar; alertas de certificado próximo a vencer; backups programados.
- **Manual:** Resolución de rechazos por contenido (cambiar datos y reenviar); activación/desactivación de tenants; cambios de plan y facturación (Stripe ya automatiza cobro, la decisión de cambio es negocio).

### 6.4 Control de empresas (tenants)

- Ya existe: Tenant, Subscription, Plan, TenantModule; provider (platform admin) gestiona tenants.
- Falta: pantalla de uso por tenant (facturas emitidas, almacenamiento, etc.) para soporte y cobro; desactivación automática por impago (suspender acceso sin borrar datos).

### 6.5 Licenciamiento / activaciones

- Buenas prácticas: identificar instalación o tenant por ID; no hardcodear “activaciones” en front; validar en backend que el tenant tenga plan activo y módulo habilitado antes de operaciones sensibles (venta, facturación, reportes premium). Stripe webhook ya actualiza estado de suscripción; usar ese estado para permitir o denegar uso.

---

## Resumen priorizado

### Crítico (antes de producción real)

1. **DIAN:** Implementar envío real, CUFE real, validaciones pre-envío y manejo de rechazos/reintentos.
2. **Idempotencia cola:** Usar `jobId` en `dianQueue.add()` para evitar doble procesamiento del mismo documento.
3. **Seguridad:** Certificados y PIN/secretos fuera de .env en repo; usar gestor de secretos en prod; no loguear secretos.
4. **CORS/ALLOWED_ORIGINS:** Ya validado en prod; mantener configurado en Render/Vercel.

### Importante (estabilidad y escalabilidad)

5. **Límites de paginación:** Validar `limit` máximo (ej. 100) en DTOs de listados.
6. **Swagger:** Alinear enums y respuestas con el modelo real (ej. estado DIAN); documentar 4xx en endpoints clave.
7. **Config DIAN por tenant:** Usar DianConfig por tenant cuando haya múltiples empresas con distintos certificados.
8. **Timeouts y reintentos:** En HTTP a DIAN, timeout y política de reintentos definida.
9. **Dead-letter / alertas:** Tras agotar reintentos en cola DIAN, notificar o marcar documento para revisión.

### Deseable (mejora continua)

10. **Reportes:** Extraer handlers o casos de uso para reducir tamaño de ReportsService y mejorar tests.
11. **Entitlements:** Capa que aplique límites por plan (facturas, usuarios) antes de crear recursos.
12. **Cache de certificado:** En memoria para no leer .p12 en cada firma (con cuidado de seguridad).
13. **Guardar XML en storage:** Por tenant para auditoría y reenvío.

---

Si quieres, el siguiente paso puede ser: (a) auditoría solo DIAN (profundizar en XML, firma y envío), (b) revisión solo código (por módulo), o (c) convertir este documento en un checklist de salida a producción con ítems comprobables.
