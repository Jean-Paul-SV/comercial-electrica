# Cómo poner a prueba todo y qué falta

> **Última actualización:** 2026-02-02  
> Resumen de lo pendiente y guía para verificar todo lo implementado.

---

## 1. Qué falta (resumen)

### 🔴 Crítico – Solo DIAN real

| Pendiente | Descripción |
|-----------|-------------|
| **Envío a API DIAN** | Conectar con Web Services reales (habilitación/producción); autenticación softwareId/softwarePin; ACEPTADO/RECHAZADO y reintentos. |
| **Generación de PDF** | Crear PDF de la factura (plantilla, QR, CUFE); guardar local o cloud. |
| **Consulta estado real** | Consumir Web Service de consulta DIAN y sincronizar estados locales. |
| **CUFE real** | Calcular CUFE según Anexo Técnico DIAN (hoy se simula). |

**Documentación:** `docs/DIAN_INTEGRACION_ESTADO.md`, `docs/QUE_HACE_FALTA.md`.

### 🟡 Opcional / Futuro

- Pronóstico con modelos (ARIMA/Prophet) en lugar de regla simple.
- Clustering K-means ya está; opcional: más segmentos o métricas.
- Dashboards externos (Prometheus/Grafana) para métricas.

**Todo lo demás del plan está implementado** (RBAC, multi-tenant, onboarding, indicadores, resiliencia, auditoría, indicadores con IA, clustering, score proveedores, etc.).

---

## 2. Cómo poner a prueba todo

### 2.1 Requisitos previos

- Node.js y npm instalados.
- Docker Desktop (para Postgres y Redis).
- Archivo `.env` en la raíz (copiar de `env.example` si es la primera vez).

### 2.2 Levantar el proyecto

Desde la **raíz del proyecto** (`Comercial-Electrica`):

```powershell
# 1. Postgres y Redis
npm run db:up

# 2. (Solo primera vez) Migraciones y seed
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run prisma:seed

# 3. API + Frontend
npm run dev
```

**URLs:**

| Servicio   | URL |
|-----------|-----|
| Frontend  | http://localhost:3001 |
| API       | http://localhost:3000 |
| Swagger   | http://localhost:3000/api/docs |

**Login:** `admin@example.com` / `Admin123!`

Si algo falla, ver `docs/LEVANTAR_PROYECTO.md` y `docs/VERIFICACION_ERRORES.md`.

---

### 2.3 Tests automáticos (API)

Desde la raíz:

```powershell
npm run test:e2e
```

O solo tests unitarios de la API:

```powershell
cd apps\api
npm test
```

Los tests clave (auth, app, dian, etc.) deberían pasar. Algunos fallos en `quotes.service.spec.ts` o `sales.service.spec.ts` pueden ser preexistentes.

---

### 2.4 Checklist manual – Frontend y API

Comprobar en el navegador (http://localhost:3001) y, si aplica, en Swagger (http://localhost:3000/api/docs).

| # | Qué probar | Dónde | Qué ver |
|---|------------|--------|---------|
| 1 | **Login** | Iniciar sesión | Entras al dashboard con admin@example.com / Admin123! |
| 2 | **Dashboard** | Página principal | KPIs (ventas hoy, stock bajo, sesiones caja, cotizaciones). Tarjeta "Resumen del día" (con badge "IA" o "Resumen automático"). Alerta de stock si hay productos con stock bajo. |
| 3 | **Sugerencias (indicadores)** | Dashboard → sección Sugerencias | Lista de indicadores (productos con pérdida, sin rotación, facturas vencidas, margen bajo, reorden, pronóstico demanda, segmentación clientes, score proveedores, ventas por empleado, anomalía ventas hoy). En ítems con precio sugerido debe verse "Precio sug. 15%: $X". |
| 4 | **Reportes** | Menú → Reportes | Pestañas: Dashboard, Ventas, Inventario, Caja, Clientes, **Clusters (K-means)**. En Clusters: segmentos con lista de clientes (o mensaje "Se necesitan al menos k clientes..."). |
| 5 | **Productos / Clientes / Ventas** | Menús correspondientes | Listados, filtros, crear/editar según permisos. |
| 6 | **Caja** | Menú → Caja | Sesiones, abrir/cerrar, movimientos. |
| 7 | **Cotizaciones** | Menú → Cotizaciones | Crear, enviar, convertir a venta. |
| 8 | **Inventario** | Menú → Inventario | Movimientos de stock. |
| 9 | **Proveedores / Compras / Facturas proveedor** | Menús | CRUD y listados. |
| 10 | **Auditoría** | Menú → Auditoría | Lista de eventos y opción "Verificar cadena". |
| 11 | **Onboarding** | Si el usuario está en not_started/in_progress | Flujo de 3 pasos; en dashboard el panel "Tu progreso". |
| 12 | **Plan requerido** | Módulo no asignado al tenant | Página "Plan requerido" al entrar a una ruta que exige ese módulo. |

---

### 2.5 Probar endpoints de reportes e IA (Swagger o curl)

Con el token JWT (obtenido tras login en el frontend o con POST `/auth/login` en Swagger):

| Endpoint | Método | Parámetros | Qué comprobar |
|----------|--------|------------|----------------|
| `/reports/dashboard` | GET | — | JSON con sales.today, inventory.lowStockCount, cash.openSessions, quotes.pending. |
| `/reports/actionable-indicators` | GET | `days=30`, `top=10` | Lista de indicadores con code, title, insight, items (algunos con suggestedPrice). |
| `/reports/dashboard-summary` | GET | `days=30` | `summary` (texto), `source`: "llm" o "fallback". |
| `/reports/operational-state` | GET | — | indicators (cash, inventory, quotes, sales, supplierInvoices), alerts[]. |
| `/reports/customer-clusters` | GET | `days=90`, `k=3` | periodDays, k, clusters[] con label y customers[]. |
| `/reports/sales` | GET | startDate, endDate (opc.) | period, summary, sales[]. |
| `/reports/inventory` | GET | lowStock (opc.) | statistics, products[]. |
| `/reports/cash` | GET | — | summary, sessions[]. |
| `/reports/customers` | GET | top (opc.) | totalCustomers, topCustomers[]. |
| `/metrics/prometheus` | GET | — | Texto plano con métricas (si observabilidad activa). |
| `/audit-logs/verify-chain` | GET | — | Valida la cadena de hashes de auditoría. |

---

### 2.6 Probar flujo DIAN (facturación electrónica)

Lo que **sí** está implementado (sin enviar a la DIAN real):

1. **Generación XML UBL 2.1** – El worker genera el XML correcto.
2. **Firma digital** – Si en `.env` tienes `DIAN_CERT_PATH` y `DIAN_CERT_PASSWORD` (ruta a un .p12 válido), el documento se firma con RSA-SHA256. Si no, se genera XML sin firmar (y un aviso en logs).
3. **Cola y estados** – En la UI de facturas/ventas puedes ver documentos en cola y su estado (PENDING, SENT, etc.). El envío real a la DIAN aún no está; el worker simula éxito.

Para probar:

- Crear una venta y asociar o generar factura electrónica (según el flujo de tu app).
- Revisar en base de datos o logs que se genera el XML (y que se firma si hay certificado).
- Ver en la UI el estado del documento (simulado).

---

### 2.7 Variables de entorno útiles para pruebas

En `.env` (raíz o el que use la API):

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Postgres (obligatorio). |
| `REDIS_URL` | Redis (obligatorio para colas/cache). |
| `JWT_ACCESS_SECRET` | Login (obligatorio). |
| `OPENAI_API_KEY` | Resumen del día con IA (opcional; si no está, source = "fallback"). |
| `DIAN_CERT_PATH` / `DIAN_CERT_PASSWORD` | Firma digital del XML (opcional). |
| `LOG_FORMAT=json` | Logs en JSON (opcional). |

---

## 3. Resumen

- **Qué falta:** Solo integración DIAN real (envío, PDF, consulta estado, CUFE). El resto del plan está hecho.
- **Cómo probar:** Levantar con `npm run db:up` y `npm run dev`, ejecutar tests con `npm run test:e2e` y `npm test` en api, y seguir el checklist manual (login, dashboard, sugerencias, reportes, clusters, auditoría, etc.) y los endpoints de reportes/IA en Swagger.

**Documentos relacionados:**  
`LEVANTAR_PROYECTO.md`, `VERIFICACION_ERRORES.md`, `QUE_HACE_FALTA.md`, `DIAN_INTEGRACION_ESTADO.md`, `FRONTEND_PENDIENTES_IMPLEMENTACION.md`.
