   # Auditoría técnica completa — Plataforma SaaS multi-tenant

**Alcance:** Backend (NestJS), API (Swagger/OpenAPI), Base de datos (Prisma), Frontend (Next.js), Testing, Observabilidad, Seguridad y Optimización.  
**Criterio:** Sistema con clientes pagos; prioridad en riesgos reales y mejoras accionables.  
**Fecha:** Febrero 2026.

---

## Evaluación general del sistema

| Criterio | Valoración | Comentario breve |
|----------|------------|------------------|
| **Nivel del sistema** | **Early SaaS** (camino a Production-ready) | Base sólida: multi-tenant, RBAC, auditoría, Stripe, panel proveedor. Faltan endurecer seguridad, observabilidad y algunos aspectos de consistencia/tenant. |
| **Arquitectura** | Bien estructurada | Módulos por dominio, guards/interceptors globales, DTOs y validación centralizada. Algunos acoplamientos y endpoints sin filtrar por tenant. |
| **Seguridad** | Parcial | Auth JWT, RBAC, aislamiento por tenant en la mayoría de servicios. Rate limit muy laxo en producción; CORS y secretos mejorables. |
| **Rendimiento** | Aceptable | Caché en listados y entidades; riesgo N+1 en algunos reportes. Transacciones bien usadas en ventas/caja. |
| **Testing** | Insuficiente para producción | E2E en flujos clave; pocos unitarios; sin tests de frontend; sin tests de carga. |
| **Observabilidad** | Básica | Health con DB/Redis/Queues; métricas en memoria y Prometheus; logs estructurados. Falta tracing, alertas y SLI/SLO. |

---

# 1. Backend / API (NestJS)

## 1.1 Arquitectura modular y límites de contexto

**Fortalezas:**
- Módulos por dominio (auth, catalog, customers, sales, cash, reports, audit, billing, provider, etc.) con dependencias claras.
- CommonModule centraliza CacheService, AuditService, filtros, interceptors y DTOs compartidos.
- Guards globales (ThrottleAuthGuard) e interceptors globales (TenantContext, AuditContext, Idempotency, RequestMetrics) aplicados de forma coherente.

**Hallazgos:**
- **Alto:** `AppService.getStats()` no filtra por `tenantId`. Cualquier usuario con permiso `reports:read` recibe conteos **globales** (todos los tenants). Fuga de información multi-tenant. **Acción:** Hacer que getStats reciba `tenantId` del usuario (o restringir a platform admin) y filtrar todos los `count()` por `tenantId`.
- **Medio:** ReportsModule es muy grande (múltiples reportes en un mismo servicio). A medio plazo conviene dividir por dominio (sales report, inventory report, etc.) o al menos por archivos para mantener testabilidad y claridad.
- **Bajo:** Algunos servicios (p. ej. SalesService) tienen muchas responsabilidades (ventas, facturas, anulaciones). Valorar extraer InvoiceService y/o anulaciones a un módulo dedicado cuando crezca la lógica.

## 1.2 DTOs, Pipes, Guards, Interceptors y Filters

**Fortalezas:**
- ValidationPipe global con `whitelist`, `transform`, `forbidNonWhitelisted` y mensajes de validación personalizados (paths tipo `items[0].qty`).
- Uso consistente de `ParseUUIDPipe` en params de ID.
- Guards por ruta: JwtAuthGuard, PermissionsGuard, ModulesGuard, PlatformAdminGuard; decoradores @RequirePermission y @RequireModule.
- AllExceptionsFilter global: respuestas HTTP consistentes, mapeo de errores Prisma a HTTP, logging por nivel (5xx error, 4xx warn), requestId en respuesta.

**Hallazgos:**
- **Medio:** No existe un “resource not found” estándar para rutas no definidas (404 de Nest por defecto). Valorar un catch-all que devuelva el mismo formato ErrorResponseDto.
- **Bajo:** Algunos controladores no declaran @RequirePermission en todas las rutas sensibles (p. ej. cash, sales solo JwtAuthGuard). Si la política es “solo ADMIN puede X”, debería reflejarse en permisos para no depender solo del rol en frontend.
- **Bajo:** IdempotencyInterceptor solo cachea la respuesta exitosa; si dos requests con la misma Idempotency-Key llegan en paralelo, ambos pueden ejecutar la lógica. Para pagos/facturación, considerar bloqueo por clave (Redis lock) en la primera request hasta completar.

## 1.3 Manejo de errores HTTP y consistencia de respuestas

**Fortalezas:**
- ErrorResponseDto con statusCode, error, message, timestamp, path, requestId y opcionalmente details.
- Prisma: P2002→409, P2025/P2001→404, P2003→400, P2034→409, etc. Mensajes en español y sin filtrar detalles sensibles en producción.
- Validación: array de mensajes con path (ej. `items[0].qty: must be positive`).

**Hallazgos:**
- **Bajo:** En 5xx el filter no sanitiza `exception.message` si no es HttpException (podría filtrar stack en producción si se expone por error).
- **Bajo:** Algunos servicios lanzan `BadRequestException` con mensajes ad hoc; conviene centralizar mensajes clave en constantes o i18n para consistencia y futura traducción.

## 1.4 Validaciones de negocio vs validaciones de entrada

**Fortalezas:**
- Validaciones de entrada en DTOs (class-validator) y ValidationPipe.
- Validaciones de negocio en servicios: cierre de caja con ventas pendientes, stock suficiente en ventas, fecha de gasto no futura, fechas en facturas proveedor, proveedor activo, etc. Documentadas en VALIDACIONES_NEGOCIO.md.
- CashLimitsService para límites configurables (montos, cantidades).

**Hallazgos:**
- **Medio:** En algunos puntos se usa `throw error` tras catch de Prisma (p. ej. P2002 en suppliers), perdiendo el formato estándar del filter. Mejor re-lanzar ForbiddenException/BadRequestException con mensaje claro para que el filter no reciba el raw Prisma.
- **Bajo:** Validaciones de negocio dispersas; un documento o módulo “business-rules” (o tests de reglas) ayudaría a no duplicar ni olvidar reglas al añadir features.

## 1.5 Seguridad: auth, RBAC, multi-tenant, rate limiting, CORS

**Fortalezas:**
- JWT con estrategia Passport; refresh token en producción; bloqueo de login si tenant suspendido.
- RBAC: Permission, Role, RolePermission, UserRole; PermissionsGuard y @RequirePermission; módulos con ModulesGuard y @RequireModule.
- Aislamiento por tenant: la mayoría de servicios reciben `tenantId` (desde req.user) y lo usan en todos los `where`. TenantContextInterceptor rellena req.user.tenantId.
- CORS configurable por ALLOWED_ORIGINS en producción; credentials true.
- Request ID (x-request-id) para trazabilidad.
- Webhook Stripe: verificación de firma con rawBody; sin auth en esa ruta (correcto).

**Hallazgos:**
- **Crítico:** GET /stats devuelve datos globales a cualquier usuario con reports:read (ver 1.1). Corregir filtrando por tenantId o restringiendo a platform admin.
- **Alto:** En producción ThrottleAuthGuard solo aplica límite a POST /auth/forgot-password (3/15 min por email). El resto de rutas no tienen rate limit efectivo (ThrottlerModule está configurado pero el guard hace return true). Riesgo de abuso (scraping, fuerza bruta en login, DoS). Acción: aplicar límites por IP y/o por usuario en login y en endpoints costosos (reportes, export).
- **Alto:** CORS: si ALLOWED_ORIGINS está vacío en producción, se usa `origin: true` (cualquier origen). Para SaaS con clientes pagos, conviene fijar orígenes permitidos.
- **Medio:** No hay rotación de secrets (JWT, Stripe) documentada ni proceso para invalidad tokens en caso de compromiso.
- **Medio:** Login: no hay límite explícito de intentos fallidos por IP/email (solo el throttle genérico si se activara). Valorar límite tipo 5 intentos / 15 min por email.
- **Bajo:** ApiExcludeEndpoint en webhook Stripe está bien; asegurar que en Swagger no se expongan rutas internas o de administración sin documentar la necesidad de platform admin.

## 1.6 Performance: N+1, transacciones, batch, caché

**Fortalezas:**
- Transacciones en flujos críticos: creación de venta (sale, items, cashMovement, invoice, dianDocument, inventoryMovement); cierre de caja no; gastos con eliminación de movimiento.
- Caché Redis: listados de productos/clientes/ventas (primera página sin filtros, TTL 60–90 s); entidades por ID (product, customer, supplier, quote por ID, supplierInvoice, purchaseOrder); invalidación por patrón al crear/actualizar/eliminar.
- Uso de `findMany` con `where: { id: { in: ids } }` y `include` en ventas para evitar N+1 en items/product/customer.
- Índices compuestos en Prisma (tenantId, soldAt; tenantId, status en quotes; etc.).

**Hallazgos:**
- **Medio:** ReportsService: getOperationalState y otros reportes hacen varias consultas secuenciales; algunas podrían paralelizarse con Promise.all o reducirse a menos round-trips. Revisar consultas con muchos includes anidados.
- **Medio:** listSales incluye items, product, customer, invoices, createdBy; si el listado es largo, el payload crece. Valorar listado “ligero” (sin items completos) y detalle bajo demanda.
- **Bajo:** IdempotencyInterceptor escribe en Redis en tap() después de la respuesta; si el proceso muere antes, la siguiente request con la misma clave podría re-ejecutar. Aceptable para muchos casos; para pagos críticos valorar “lock + guardar resultado atómico”.
- **Bajo:** CacheService.deletePattern usa SCAN (correcto); asegurar que el patrón no sea demasiado amplio (ej. cache:*) en instancias con muchas claves.

## 1.7 Idempotencia en endpoints críticos

**Fortalezas:**
- IdempotencyInterceptor aplicado globalmente; acepta header Idempotency-Key (UUID); cachea respuesta 24 h; solo POST/PATCH/PUT.
- Frontend puede enviar Idempotency-Key en mutaciones (ej. ventas) para reintentos seguros.

**Hallazgos:**
- **Medio:** El interceptor no distingue por ruta; una misma clave podría teóricamente reutilizarse en otra ruta (poco habitual). Opcional: incluir método + path en la clave de caché para mayor seguridad semántica.
- **Bajo:** Billing webhook no usa Idempotency-Key; Stripe reenvía eventos. El handler debería ser idempotente por event.id (evitar procesar dos veces el mismo evento). Revisar si se guarda event.id procesado y se ignora duplicado.

## 1.8 Logs, auditoría y trazabilidad

**Fortalezas:**
- AuditLog con tenantId, actorId, entity, entityId, action, diff, requestId, ip, userAgent, severity, category, summary, previousHash/entryHash.
- AuditContextInterceptor inyecta requestId, ip, userAgent, tenantId (tras TenantContextInterceptor).
- Cadena de integridad (hash chain) y GET /audit-logs/verify-chain.
- Listado y GET por entidad filtrados por tenantId.
- Auditoría en creación/actualización/eliminación en los módulos principales (users, catalog, customers, suppliers, sales, cash, expenses, supplier-invoices, purchases, returns, backups).
- JsonLogger opcional (LOG_FORMAT=json) para producción.
- AllExceptionsFilter registra 4xx como warn y 5xx como error con contexto (path, method, userId, requestId).

**Hallazgos:**
- **Bajo:** Algunos flujos (p. ej. conversión cotización→venta) podrían registrar un log explícito “quote convertida a sale” con IDs para búsqueda rápida.
- **Bajo:** En producción, definir retención de logs (audit + aplicación) y archivado para cumplimiento.

---

# 2. Swagger / OpenAPI

## 2.1 Completitud y exactitud

**Fortalezas:**
- DocumentBuilder con título, descripción, versión 1.0, Bearer JWT (JWT-auth), tags por dominio.
- Documento generado con SwaggerModule.createDocument; muchos DTOs tienen ApiProperty/ApiPropertyOptional (listados, create, update, query params).
- Health y rutas principales documentadas con @ApiOperation y @ApiResponse.

**Hallazgos:**
- **Medio:** No hay versionado explícito en la URL (ej. /v1/). Si en el futuro se introduce v2, conviene planificar prefijo y documentación por versión.
- **Medio:** Algunos endpoints devuelven DTOs complejos (reportes, dashboard) sin schema explícito en @ApiResponse; Swagger infiere del tipo. Para contratos estables, definir DTOs de respuesta y referenciarlos.
- **Bajo:** Faltan ejemplos en muchos DTOs (example en ApiProperty). Añadir ejemplos realistas mejora la usabilidad de la documentación.
- **Bajo:** Errores 400/404/409 documentados de forma genérica en muchos sitios; se podría referenciar ErrorResponseDto y documentar códigos por operación.

## 2.2 Seguridad declarada

**Fortalezas:**
- addBearerAuth con nombre 'JWT-auth'; controladores usan @ApiBearerAuth('JWT-auth').
- Rutas públicas (login, forgot-password, etc.) sin bearer.

**Hallazgos:**
- **Medio:** En Swagger no se declaran permisos ni roles por operación (solo “requiere JWT”). Un desarrollador externo no ve que reports:read o audit:read son necesarios. Añadir en descripción o en extensiones (x-permission, x-role) mejoraría el contrato.
- **Bajo:** Webhook Stripe está excluido (@ApiExcludeEndpoint); correcto. Mantener exclusión de rutas internas o de proveedor si se añaden.

---

# 3. Base de datos / Prisma

## 3.1 Schema: relaciones, cardinalidad, cascadas

**Fortalezas:**
- Modelo multi-tenant coherente: Tenant como raíz; entidades de negocio con tenantId y onDelete: Cascade o SetNull según caso.
- Relaciones bien definidas: Sale → SaleItem, Invoice, CashMovement; Quote → QuoteItem; PurchaseOrder → PurchaseOrderItem; etc.
- Uniques por tenant donde aplica: (tenantId, internalCode), (tenantId, docType, docNumber), (tenantId, nit), (tenantId, orderNumber), (tenantId, invoiceNumber), (tenantId, name) en Category.
- Sale.onDelete: Restrict en SaleItem (evita borrar venta con ítems por error); CashMovement sin onDelete en relatedSaleId (evitar borrar venta si hay movimiento).

**Hallazgos:**
- **Medio:** Customer no tiene tenantId en el schema mostrado en el primer bloque; en migraciones posteriores se añadió tenantId a muchas tablas. Verificar que Customer, Sale, Quote, Invoice, Expense, CashSession, etc. tengan tenantId y que no queden tablas “globales” que deban ser por tenant.
- **Bajo:** Algunas relaciones opcionales (categoryId, customerId) con SetNull; coherente con negocio. Revisar que no haya ciclos de dependencia que compliquen borrados.
- **Bajo:** Subscription y Plan: Plan con stripePriceId; Subscription con stripeSubscriptionId y lastPaymentFailedAt. Relación correcta; asegurar que las migraciones estén aplicadas en todos los entornos.

## 3.2 Índices

**Fortalezas:**
- Índices por tenantId en tablas de negocio; compuestos (tenantId, status), (tenantId, validUntil) en Quote; (tenantId, soldAt) en Sale.
- Índices en createdAt, status, dueDate, invoiceDate en facturas proveedor; sessionId, relatedSaleId en CashMovement; etc.
- AuditLog: tenantId, createdAt, entity+entityId, actorId, action, severity, category, requestId.

**Hallazgos:**
- **Medio:** Listados con orden por fecha (soldAt, issuedAt, expenseDate) y filtro por tenant: compuestos (tenantId, soldAt) ya existen. Revisar listados que ordenen por otro campo (ej. name) y no tengan índice compuesto (tenantId, name) si son páginas grandes.
- **Bajo:** Si hay consultas por range de fechas + tenantId, índices (tenantId, dateField) suelen ser suficientes. No se detectan faltas graves.
- **Bajo:** BackupRun, AuditLog: si se consultan por rangos de tiempo muy grandes, considerar particionado por fecha en el futuro (no urgente).

## 3.3 Soft deletes vs deletes

**Fortalezas:**
- Proveedores: “delete” es soft (isActive: false) y se audita como logDelete.
- Productos: desactivación (isActive: false) en lugar de borrado físico.
- Usuarios: isActive para desactivar sin borrar.

**Hallazgos:**
- **Bajo:** Gastos y otros: delete físico. Aceptable si no hay requisito de auditoría de “registro borrado”; si hubiera que conservar historial, valorar soft delete con deletedAt.
- **Bajo:** Documentar política: qué se borra físicamente y qué se desactiva, para consistencia en nuevos módulos.

## 3.4 Transacciones y consistencia

**Fortalezas:**
- Creación de venta en transacción serializable (Prisma.TransactionIsolationLevel.Serializable) con creación de sale, items, cashMovement, invoice, dianDocument, inventoryMovement.
- Gastos: eliminación de CashMovement y Expense en transacción.
- Provider createTenant: tenant + subscription + user en transacción.

**Hallazgos:**
- **Medio:** Cierre de caja (closeSession) no está envuelto en transacción; es un único update. Aceptable; si en el futuro se añaden más pasos (ej. crear asiento contable), usar transacción.
- **Bajo:** Conversión cotización→venta: revisar que toda la operación sea atómica (quote update + sale create + invoice + etc.) dentro de una transacción.

## 3.5 Migraciones y rollback

**Hallazgos:**
- **Medio:** Migraciones Prisma secuenciales; no hay evidencia de rollback probado (down migrations). Para producción, definir estrategia: backups pre-migración y, si se requiere rollback, scripts de reversión o restauración desde backup.
- **Bajo:** Migraciones con ADD COLUMN IF NOT EXISTS u opcionales reducen riesgo de fallo en entornos ya parcialmente migrados; mantener buena práctica de migraciones reversibles cuando sea posible.

## 3.6 Consultas pesadas y planes de ejecución

**Hallazgos:**
- **Medio:** getStats (una vez corregido por tenant) hace varios count y un aggregate; aceptable. Reports (dashboard, sales, inventory) pueden ser pesados con muchos datos; ya hay caché de dashboard (60 s). Revisar tiempo de respuesta en producción con datos reales.
- **Bajo:** Si aparecen timeouts en reportes, considerar: límite de rango de fechas, paginación, o jobs en background con resultado cacheado.

---

# 4. Frontend

## 4.1 Arquitectura y separación de responsabilidades

**Fortalezas:**
- Estructura clara: app/(protected) y app/(public); features por dominio (auth, sales, quotes, reports, etc.) con api, hooks, types; shared para UI, navegación, providers, utils.
- Un solo cliente API (infrastructure/api/client.ts) con reintentos, timeout, Idempotency-Key opcional.
- AuthProvider centraliza usuario, permisos, módulos habilitados, isPlatformAdmin; layout protegido usa canAccessPath y getModuleForPath para redirecciones.

**Hallazgos:**
- **Bajo:** Algunas páginas son muy largas (ej. listados con formularios inline). Valorar extraer formularios a componentes o a páginas modales para mejorar mantenibilidad.
- **Bajo:** Lógica de negocio (cálculos, validaciones) a veces en componentes; en casos críticos (ej. totales, descuentos) conviene centralizar en hooks o utils y testear.

## 4.2 Estado, queries y caché

**Fortalezas:**
- React Query (TanStack Query) para datos: useQuery/useMutation por feature; invalidación de queries tras mutaciones (onSuccess con queryClient.invalidateQueries).
- Cache de listados (productos, clientes, ventas) en backend; el frontend se beneficia sin lógica adicional.

**Hallazgos:**
- **Medio:** Revisar que todas las mutaciones que modifican listados invaliden las queries correctas (ej. crear venta → invalidar ventas y posiblemente dashboard). Evitar datos obsoletos tras navegar.
- **Bajo:** Tiempos de staleTime/cacheTime por defecto; en pantallas muy sensibles (ej. caja) valorar staleTime 0 o bajo para no mostrar saldos antiguos.

## 4.3 UX en formularios

**Fortalezas:**
- Toasts (sonner) en mutaciones; mensajes de éxito y error.
- getErrorMessage() para normalizar mensajes de API y códigos HTTP; usado en clientes.
- Skeleton en listados y detalles durante carga.
- Validación con zod y react-hook-form en varios formularios.

**Hallazgos:**
- **Medio:** No todos los formularios usan getErrorMessage en onError; extenderlo reduce mensajes genéricos.
- **Bajo:** Algunos formularios largos (cotizaciones, facturas proveedor) podrían mostrar resumen de errores de validación (array de la API) en un bloque además del toast.
- **Bajo:** Estados de carga en botones (isPending) en la mayoría de mutaciones; asegurar que estén en todos los submit críticos.

## 4.4 Seguridad frontend

**Fortalezas:**
- Rutas protegidas bajo (protected); layout verifica isAuthenticated, canAccessPath(role), isPlatformAdmin para /provider, y módulo habilitado para la ruta (plan-required si no tiene el módulo).
- Token en memoria/localStorage; envío vía Authorization header. No se observa token en query params.
- Redirección a /login si no autenticado; a /app si rol no puede la ruta; a /plan-required si falta módulo.

**Hallazgos:**
- **Medio:** Si el token se guarda en localStorage, es vulnerable a XSS. Valorar httpOnly cookies para refresh y acceso corto en memoria, o mitigar XSS (CSP, sanitización) y rotación de tokens.
- **Bajo:** Permisos y módulos vienen de GET /auth/me; la UI oculta acciones según permissions/enabledModules. La autorización real está en el backend; el frontend solo mejora UX. Mantener esa disciplina.
- **Bajo:** No exponer en el cliente datos sensibles (ej. stripePriceId completo si no es necesario en UI).

## 4.5 Performance frontend

**Fortalezas:**
- Next.js App Router; páginas bajo app/ con lazy implícito por ruta.
- Uso de select en listados (solo campos necesarios) en backend; evita payloads gigantes.

**Hallazgos:**
- **Medio:** Revisar bundle size (next/build o analizar); si hay librerías pesadas (gráficas, PDF, etc.), valorar dynamic import para rutas que no las usan.
- **Bajo:** Listados muy largos sin virtualización; si en el futuro hay miles de filas, considerar virtualización (react-window o similar).
- **Bajo:** Re-renders: componentes que solo dependen de un slice del estado deberían estar bien con hooks; no se detecta uso excesivo de contexto global que fuerce re-renders masivos.

## 4.6 Accesibilidad y responsive

**Hallazgos:**
- **Medio:** No se ha revisado en detalle ARIA, contraste, navegación por teclado ni lectores de pantalla. Para producción con clientes diversos, conviene una pasada de a11y (lighthouse, axe) y ajustes.
- **Bajo:** Uso de componentes tipo Card, Table, Button; estructura semántica razonable. Revisar labels en formularios y mensajes de error asociados a campos.
- **Bajo:** Responsive: Tailwind y layouts flex/grid; revisar en móvil listados y formularios complejos (tablas horizontales, modales).

---

# 5. Testing

## 5.1 Estrategia y cobertura

**Fortalezas:**
- E2E (Jest + Supertest): app, backups, cash, inventory, quotes (flujo completo), reports (dashboard, sales, inventory, operational-state), sales, suppliers-purchases-payables.
- Helpers compartidos: setupTestModule (mock AuditService), setupTestApp, cleanDatabase, setupTestUser, shutdownTestApp.
- Tests unitarios en: auth.service, cash.service (cierre con ventas pendientes, sesión cerrada), quotes.service, dian.service, inventory.service.

**Hallazgos:**
- **Alto:** No hay tests E2E para: flujo de suscripción/Stripe (webhook), flujo de suspensión por impago, auditoría (listado filtrado por tenant), onboarding completo, provider (crear tenant, cambiar plan). Los flujos de pago y tenant son críticos para un SaaS.
- **Alto:** Cobertura unitaria limitada a unos pocos servicios; muchos servicios sin tests (reports, sales, supplier-invoices, expenses, etc.). Las validaciones de negocio documentadas en VALIDACIONES_NEGOCIO.md son candidatas a tests unitarios.
- **Medio:** No hay tests de integración que mockeen solo DB (sin HTTP) para servicios puros; podría acelerar feedback.
- **Medio:** Tests E2E dependen de cleanDatabase y datos creados en beforeAll; si hay tenantId requerido en Product/Customer, los seeds deben incluir tenant (y posiblemente crear un tenant de test). Revisar que los E2E no fallen en esquema actual.
- **Bajo:** No hay tests de frontend (componentes o integración con MSW). Formularios críticos (venta, caja, cotización) serían candidatos.
- **Bajo:** No hay tests de carga ni de resiliencia (timeout, reintentos); recomendable antes de escalar.

## 5.2 Riesgos por falta de tests

- Regresiones en cierre de caja, creación de venta, conversión cotización→venta, y filtrado por tenant en reportes/auditoría.
- Cambios en Stripe o en lógica de suscripción sin detección automática.
- Refactors en permisos o módulos sin garantía de que el flujo de acceso siga correcto.

---

# 6. Observabilidad y operación

## 6.1 Logs

**Fortalezas:**
- Logger de Nest; AllExceptionsFilter registra status, path, method, userId, requestId, ip, userAgent en 4xx/5xx.
- Opción LOG_FORMAT=json (JsonLogger) para producción.
- AuditLog con requestId, ip, userAgent para correlación.

**Hallazgos:**
- **Medio:** No hay un correlation id único propagado a todos los logs de una request (más allá de requestId en el filter). Valorar middleware que inyecte un ID en el logger context para todas las líneas de esa request.
- **Bajo:** Niveles de log (debug/info/warn/error) no están estandarizados por tipo de evento; definir criterios (ej. errores de negocio = warn, fallos de sistema = error).
- **Bajo:** Logs de negocio (ej. “Venta creada”, “Sesión cerrada”) en servicios; útiles; evitar loguear datos personales o secretos.

## 6.2 Métricas

**Fortalezas:**
- MetricsService: totalRequests, statusBuckets (2xx/3xx/4xx/5xx), latencia avg/max, topRoutes (hasta 200 claves).
- RequestMetricsInterceptor registra cada request.
- Endpoint Prometheus (getPrometheusText) para scraping.
- Endpoint /metrics (o similar) con snapshot JSON para dashboards.

**Hallazgos:**
- **Medio:** Métricas solo en memoria; al reiniciar se pierden. Para producción, exportar a Prometheus/StatsD o similar y persistir.
- **Medio:** No hay métricas de negocio (ventas/día, sesiones abiertas, errores de pago) expuestas como métricas; podrían derivarse de logs o de BD en un job.
- **Bajo:** Cardinalidad de “route” limitada a 200; suficiente para no reventar memoria; vigilar si se añaden muchos path params que fragmenten la clave.

## 6.3 Alertas

**Hallazgos:**
- **Alto:** No hay alertas configuradas (no se ve integración con PagerDuty, Slack, etc.). Recomendable: alertas por tasa de 5xx, latencia p95, health check fallido, colas con failed > N, BD/Redis desconectados.
- **Medio:** Health devuelve status degraded si DB/Redis/queues fallan; un monitor externo (UptimeRobot, Pingdom o el orquestador) puede hacer GET /health y alertar.
- **Bajo:** Alertas de negocio (ej. “ninguna venta en 24 h en tenant X”) pueden ser una segunda fase.

## 6.4 Health y readiness

**Fortalezas:**
- GET /health sin auth: comprueba DB ($queryRaw SELECT 1), Redis (ping), colas BullMQ (dian, backup, reports); devuelve status ok/degraded, uptime, environment, responseTime.
- Respuesta estructurada con servicios.database, services.redis, services.queues.

**Hallazgos:**
- **Bajo:** No hay separación explícita liveness vs readiness (Kubernetes); un único /health puede servir para ambos si el orquestador lo usa para ambos probes. Si se necesita “listo para tráfico” (readiness) distinto de “proceso vivo” (liveness), añadir /ready que no dependa de colas opcionales si aplica.
- **Bajo:** Health no comprueba espacio en disco ni dependencias externas (Stripe, correo); opcional para un “deep” health.

## 6.5 Backups y restore

**Fortalezas:**
- Módulo de backups (pg_dump), descarga, verificación por checksum, copia a S3 si está configurado, limpieza de backups antiguos.
- Documentación de runbook y política de retención.

**Hallazgos:**
- **Medio:** No hay evidencia de pruebas periódicas de restore (restore en entorno de staging y comprobar integridad). Recomendable automatizar o calendarizar.
- **Bajo:** Backups de Redis (sesiones, caché, idempotencia) no están mencionados; si Redis se usa solo como caché, puede ser aceptable no respaldarlo; si hubiera datos críticos, valorar persistencia y backup.

---

# 7. Seguridad

## 7.1 OWASP Top 10 (resumen)

- **Inyección:** Prisma parametriza queries; no hay SQL crudo con concatenación. Validación de entrada vía DTOs. Bajo riesgo.
- **Auth:** JWT con secreto; contraseñas con argon2. Riesgo: rate limit en login y rotación de secretos (ver 1.5).
- **Exposición de datos sensibles:** getStats global (crítico). Logs y respuestas de error sin filtrar detalles de BD en prod; revisar que stack traces no se envíen al cliente.
- **XML/External entities:** No aplicable en la API actual.
- **Control de acceso:** RBAC y tenant en backend; frontend oculta según permisos. Falla: /stats sin filtro tenant.
- **Configuración insegura:** CORS y ALLOWED_ORIGINS; rate limit desactivado en prod para la mayoría de rutas. Validación de env en arranque (validateEnv).
- **XSS:** Frontend React escapa por defecto; asegurar que no se use dangerouslySetInnerHTML con input de usuario. localStorage para token (riesgo XSS si hay inyección).
- **Deserialización:** JSON con ValidationPipe y DTOs; riesgo bajo.
- **Componentes con vulnerabilidades:** Mantener dependencias actualizadas (npm audit, Dependabot).
- **Logging y monitoreo:** Logs de 4xx/5xx y auditoría; falta respuesta a incidentes (alertas, runbook).

## 7.2 Secretos

**Hallazgos:**
- **Medio:** JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATABASE_URL, REDIS_URL, STRIPE_* deben estar en variables de entorno, no en código. validateEnv exige DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET; en prod JWT_REFRESH_SECRET. No hay evidencia de uso de un vault (HashiCorp Vault, AWS Secrets Manager); aceptable para early SaaS si el despliegue restringe acceso a env.
- **Bajo:** Documentar qué variables son secretas y rotar en caso de fuga (incl. STRIPE_WEBHOOK_SECRET si se regenera en Stripe).

## 7.3 Protección contra abuso

**Hallazgos:**
- **Alto:** Rate limit efectivo solo en forgot-password en producción (ver 1.5). Añadir límites por IP para POST /auth/login (ej. 10/min) y por usuario para endpoints pesados (reportes, export).
- **Medio:** Idempotency-Key evita duplicados por clave pero no por IP; un atacante podría consumir muchas claves. Límite por IP en número de requests/min mitigaría DoS.
- **Bajo:** Stripe webhook: verificación de firma; sin verificación un atacante podría enviar eventos falsos. Actual implementación correcta.

## 7.4 Entornos

**Hallazgos:**
- **Bajo:** NODE_ENV y validateEnv diferencian producción (JWT_REFRESH_SECRET requerido). Asegurar que en staging/prod no se usen secrets de desarrollo y que ALLOWED_ORIGINS y URLs de frontend estén bien configurados.

---

# 8. Optimización y mejoras

## 8.1 Refactors recomendados (impacto / riesgo)

- **Alto impacto, bajo riesgo:** Corregir getStats para filtrar por tenantId (o restringir a platform admin). Tiempo estimado: medio día.
- **Alto impacto, medio riesgo:** Activar y afinar rate limiting en producción (login, reportes, export). Tiempo: 1–2 días.
- **Medio impacto, bajo riesgo:** Añadir @RequirePermission en rutas que hoy solo usan JwtAuthGuard donde la política de negocio lo exija. Tiempo: 1 día.
- **Medio impacto, medio riesgo:** Extraer lógica de reportes a subservicios o archivos por dominio; mejorar testabilidad. Tiempo: 2–5 días.
- **Medio impacto, bajo riesgo:** Documentar en Swagger permisos/roles por operación (x-permission) y añadir ejemplos en DTOs. Tiempo: 1–2 días.
- **Bajo impacto:** Unificar mensajes de error de negocio en constantes; usar getErrorMessage en todos los onError del frontend.

## 8.2 Optimizaciones de queries y caché

- Revisar reportes con múltiples findMany secuenciales; paralelizar con Promise.all donde no haya dependencias.
- Listados “ligeros” (sin includes pesados) para listSales/listInvoices si el volumen crece.
- Caché de reportes pesados (operational-state, dashboard) ya en uso; mantener TTLs y invalidación al cambiar datos críticos si se añaden más reportes cacheados.
- Índices: ya hay buenos compuestos; añadir (tenantId, name) u otros solo si se miden consultas lentas.

## 8.3 Latencia en endpoints críticos

- Creación de venta: ya en transacción; el cuello suele ser DIAN o cola; mantener en cola y respuesta rápida al cliente.
- Cierre de caja: un update; bajo impacto.
- Listados: caché de primera página reduce carga; vigilar p95 en producción.
- Health: incluye varias comprobaciones; si tarda mucho, considerar health “lite” para liveness (solo proceso) y “full” para readiness.

## 8.4 DX y tooling

- Scripts: prisma migrate, seed, backups documentados. Valorar script “dev:full” que levante DB, Redis, API y web con una sola orden.
- Linters y formateo: ESLint/Prettier; mantener reglas consistentes entre backend y frontend.
- Pre-commit: opcional hooks (lint, test unitarios rápidos) para evitar regresiones.
- Documentación: GUIA_TESTING_CAMBIOS_FEB2026.md, VALIDACIONES_NEGOCIO.md, runbooks; mantener actualizada con cambios de arquitectura.

## 8.5 Riesgos técnicos

- **Corto plazo:** getStats con datos globales (fuga multi-tenant); rate limit inexistente en producción (abuso). Mitigación inmediata: corregir getStats y activar throttle en login y rutas sensibles.
- **Mediano plazo:** Crecimiento de datos (reportes, auditoría) sin estrategia de retención/archivado; dependencias desactualizadas; falta de tests en flujos de pago y tenant. Mitigación: plan de retención, npm audit y CI, ampliar E2E a billing y provider.
- **Largo plazo:** Escalado horizontal (varios pods) con Redis compartido y colas; asegurar que BullMQ y caché soporten múltiples workers; health y métricas listos para orquestadores.

---

# 9. Entregables: hallazgos priorizados

## Críticos

| ID | Hallazgo | Acción |
|----|----------|--------|
| C1 | GET /stats devuelve datos globales a cualquier usuario con reports:read (fuga multi-tenant). | Filtrar todos los conteos por tenantId del usuario, o restringir el endpoint a platform admin y documentarlo. |

## Altos

| ID | Hallazgo | Acción |
|----|----------|--------|
| A1 | Rate limiting en producción solo aplica a forgot-password; login y resto de API sin límite. | Aplicar ThrottlerGuard (o equivalente) a POST /auth/login (p. ej. 10 req/min por IP) y a endpoints costosos (reportes, export); mantener bypass en desarrollo. |
| A2 | CORS en producción con ALLOWED_ORIGINS vacío permite cualquier origen. | Exigir o recomendar fuertemente configurar ALLOWED_ORIGINS en producción con los orígenes del frontend. |
| A3 | No hay tests E2E para flujos de facturación (webhook Stripe), suspensión por impago ni panel provider (crear tenant, cambiar plan). | Añadir E2E que simulen webhook Stripe (invoice.paid, payment_failed) y flujos provider con tenant de test. |
| A4 | Tests unitarios ausentes en la mayoría de servicios (reports, sales, supplier-invoices, expenses). | Priorizar tests unitarios para validaciones de negocio (ventas, caja, gastos, facturas proveedor) según VALIDACIONES_NEGOCIO.md. |
| A5 | No hay alertas configuradas (5xx, latencia, health, colas). | Configurar alertas (PagerDuty, Slack o similar) basadas en health check, métricas Prometheus y/o logs. |

## Medios

| ID | Hallazgo | Acción |
|----|----------|--------|
| M1 | IdempotencyInterceptor no evita doble ejecución en race (dos requests con misma clave en paralelo). | Para endpoints de pago/facturación, valorar lock por Idempotency-Key (Redis) hasta completar la primera request. |
| M2 | Swagger no documenta permisos/roles por operación. | Añadir en descripción o extensiones (x-permission) los permisos requeridos por ruta. |
| M3 | Algunos servicios re-lanzan errores Prisma sin mapear a HttpException; el filter puede no devolver mensaje amigable. | En catch de Prisma (P2002, etc.), lanzar BadRequestException/ConflictException con mensaje claro en lugar de throw error. |
| M4 | ReportsService muy grande; consultas secuenciales en algunos reportes. | Refactorizar por dominio o archivos; paralelizar consultas independientes con Promise.all. |
| M5 | Migraciones sin estrategia explícita de rollback. | Documentar y, si es posible, probar restauración desde backup tras migración; considerar scripts de reversión para migraciones críticas. |
| M6 | Métricas solo en memoria; se pierden al reiniciar. | Exportar métricas a Prometheus/StatsD o sistema persistente para historial y dashboards. |
| M7 | No hay pruebas periódicas de restore de backups. | Incluir en runbook pruebas de restore en entorno de staging de forma periódica. |

## Bajos

| ID | Hallazgo | Acción |
|----|----------|--------|
| B1 | Respuestas 404 de rutas no definidas sin formato ErrorResponseDto. | Opcional: catch-all que devuelva el mismo esquema de error. |
| B2 | Falta de ejemplos en muchos DTOs de Swagger. | Añadir example en ApiProperty donde ayude a integradores. |
| B3 | Token en localStorage (riesgo XSS). | Valorar httpOnly cookies para refresh o endurecer mitigaciones XSS (CSP, sanitización). |
| B4 | Auditoría: retención y archivado no definidos. | Definir política de retención de AuditLog y procedimiento de archivado. |
| B5 | Documentar política soft delete vs delete físico. | Añadir a documentación técnica qué entidades se desactivan vs se borran. |
| B6 | Accesibilidad y responsive no auditados. | Ejecutar lighthouse/axe y revisar formularios y listados en móvil. |

---

# 10. Quick wins (1–3 días)

1. **Corregir getStats (C1):** Filtrar por tenantId o restringir a platform admin. Incluir en el contrato (Swagger) quién puede llamar al endpoint.
2. **Activar rate limit en login (A1 parcial):** Configurar ThrottlerGuard para POST /auth/login en producción (p. ej. 10 req/min por IP o por body.email).
3. **Documentar permisos en Swagger (M2):** Añadir en cada operación el permiso requerido (ej. “Requiere reports:read”) en la descripción o en x-permission.
4. **Mapear Prisma a HttpException (M3):** Revisar servicios que hacen catch de Prisma y throw error; reemplazar por excepciones Nest con mensaje claro en los 2–3 más usados (ej. suppliers, customers).
5. **ALLOWED_ORIGINS (A2):** En la guía de despliegue y env.example, marcar ALLOWED_ORIGINS como obligatorio en producción y dar ejemplo.

---

# 11. Mejoras estructurales (2–6 semanas)

1. **Rate limiting completo (A1):** Límites por IP y por usuario en login, reportes, export y opcionalmente en el resto de API; mantener bypass en desarrollo; documentar en runbook.
2. **Tests E2E billing y provider (A3):** Suites para webhook Stripe (invoice.paid, payment_failed, subscription.deleted) y para crear tenant, cambiar plan, renovar suscripción.
3. **Tests unitarios de validaciones (A4):** Cubrir reglas de VALIDACIONES_NEGOCIO.md en cash, sales, expenses, supplier-invoices (al menos los casos “no debe permitir…”).
4. **Observabilidad (A5, M6):** Exportar métricas a Prometheus o equivalente; configurar alertas por 5xx, latencia p95, health failed, colas con failed > N; opcional: correlation id en logs.
5. **Idempotencia fuerte (M1):** En endpoints de pago o facturación crítica, implementar lock por Idempotency-Key (Redis) y guardar resultado atómico.
6. **Refactor de reportes (M4):** Dividir ReportsService en módulos o archivos por tipo de reporte; paralelizar consultas donde sea posible; tests unitarios por reporte.
7. **Backups y restore (M7):** Automatizar o calendarizar prueba de restore en staging; documentar en runbook.
8. **Frontend: getErrorMessage y a11y (B3, B6):** Usar getErrorMessage en todos los onError de mutaciones; ejecutar auditoría de accesibilidad y corregir hallazgos críticos.

---

# 12. Conclusión

La plataforma tiene una **base sólida** para un SaaS multi-tenant: arquitectura modular, RBAC, auditoría con trazabilidad e integridad, integración con Stripe, panel de proveedor y documentación de validaciones y testing. El **hallazgo crítico** (getStats sin filtro tenant) y los **altos** (rate limit, CORS, tests de billing/provider, alertas) son abordables en poco tiempo y mejoran mucho la preparación para **clientes pagos**. Con las correcciones críticas y altas priorizadas, el sistema se puede considerar **en camino a Production-ready**; con las mejoras estructurales (tests, observabilidad, idempotencia en pagos), estaría en condiciones de **producción con responsabilidad operativa y de seguridad**.

**Última actualización:** Febrero 2026
