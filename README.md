# Orion

Sistema de gestión integral para ferretería eléctrica: inventario, ventas, caja, clientes, gastos, cotizaciones, proveedores, facturación y reportes. Preparado para facturación electrónica DIAN (Colombia).

**Monorepo:** API (NestJS) + Web (Next.js) · PostgreSQL · Redis · Prisma

---

## Estado del proyecto (Febrero 2026)

| Área        | Estado |
|------------|--------|
| **API**    | ✅ Operativa (auth, catálogo, ventas, caja, cotizaciones, inventario, proveedores, reportes, auditoría, backups, billing, provider) |
| **Frontend** | ✅ Next.js operativo (dashboard, ventas, productos, clientes, caja, gastos, cotizaciones, proveedores, compras, reportes, auditoría, configuración, billing) |
| **DIAN**   | 🔴 Pendiente integración real (XML UBL, firma, envío, PDF/QR) |

Documento de referencia: [`docs/QUE_FALTA_HASTA_LA_FECHA.md`](./docs/QUE_FALTA_HASTA_LA_FECHA.md)

---

## Inicio rápido

Requisitos: **Node.js 18+**, **Docker** (Postgres + Redis).

```bash
# Clonar y entrar al proyecto
git clone https://github.com/Jean-Paul-SV/comercial-electrica.git
cd comercial-electrica

# Dependencias
npm install

# Variables de entorno (copiar y ajustar si hace falta)
cp env.example .env

# Base de datos y Redis
npm run db:up

# Prisma: generar cliente y migrar
npm run prisma:generate -w api
npm run prisma:migrate -w api

# Opcional: datos de prueba (admin + seed)
npm run db:seed
npm run prisma:seed -w api

# Levantar API + Web
npm run dev
```

- **API:** http://localhost:3000  
- **Web:** http://localhost:3001  
- **Swagger:** http://localhost:3000/api/docs  

Login por defecto (tras seed): `admin@example.com` / `Admin123!`

Guía detallada y solución de problemas: [docs/LEVANTAR_PROYECTO.md](./docs/LEVANTAR_PROYECTO.md).

---

## Estructura del proyecto

```
comercial-electrica/
├── apps/
│   ├── api/          # NestJS — REST API, Prisma, colas (BullMQ)
│   └── web/          # Next.js — App Router, React, Tailwind
├── infra/
│   └── docker-compose.yml   # Postgres + Redis
├── docs/             # Documentación técnica y de negocio
├── scripts/          # Seeds, utilidades
├── env.example
└── package.json      # Workspaces (api, web)
```

---

## Stack técnico

| Capa      | Tecnología |
|-----------|------------|
| Backend   | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Frontend  | Next.js (App Router), React, Tailwind CSS |
| Auth      | JWT (access + refresh) |
| Docs API  | Swagger/OpenAPI |
| Infra     | Docker Compose |

---

## Funcionalidades principales

- **Autenticación y roles** — JWT, bootstrap admin, roles (ADMIN/USER)
- **Catálogo** — Productos, categorías, diccionario de productos
- **Clientes** — CRUD, documentos (CC/NIT)
- **Inventario** — Movimientos IN/OUT/ADJUST, trazabilidad
- **Caja** — Sesiones de caja, movimientos, cierre
- **Ventas** — Ventas con factura, múltiples formas de pago
- **Cotizaciones** — Crear, editar, convertir a venta
- **Proveedores y compras** — Proveedores, facturas de proveedor
- **Gastos y devoluciones** — Registro de gastos y devoluciones
- **Reportes** — Ventas, inventario, caja, clientes
- **Auditoría** — Log de operaciones críticas
- **Backups** — Respaldos programados y bajo demanda
- **Billing (SaaS)** — Suscripciones Stripe, portal de facturación
- **Provider (multi-tenant)** — Gestión de tenants y planes (admin plataforma)

---

## Comandos útiles

```bash
# Desarrollo
npm run dev              # API + Web
npm run dev:api          # Solo API
npm run dev:web          # Solo Web

# Base de datos
npm run db:up            # Levantar Postgres + Redis
npm run db:down          # Bajar contenedores
npm run prisma:studio -w api   # GUI de la BD
npm run prisma:migrate -w api  # Aplicar migraciones

# Tests
npm run test:e2e         # E2E (api)
```

---

## Variables de entorno

Copiar `env.example` a `.env`. Principales:

- `DATABASE_URL` — PostgreSQL
- `REDIS_URL` — Redis (colas y caché)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — Auth (cambiar en producción)
- `STRIPE_*` — Billing (si usas suscripciones)
- `DIAN_*` — Facturación electrónica (cuando integres DIAN real)

Detalle completo en `env.example`.

---

## Documentación

- [Levantar el proyecto](./docs/LEVANTAR_PROYECTO.md) — Primera vez, errores frecuentes
- [Qué falta hasta la fecha](./docs/QUE_FALTA_HASTA_LA_FECHA.md) — Pendientes y prioridades
- [Índice de documentación](./docs/README.md) — Toda la documentación en `docs/`
- [Solución error EPERM (Prisma)](./docs/SOLUCION_ERROR_EPERM_PRISMA.md) — Común en Windows

---

## Próximos pasos

1. **DIAN real** — XML UBL 2.1, firma digital, envío a DIAN, PDF/QR (crítico para facturación en Colombia).
2. Ajustes y mejoras de UX en el frontend.
3. Endurecimiento y despliegue en producción (ver `docs/HARDENING_TECNICO_PRODUCCION.md`).

---

## Licencia y autor

- **Autor:** Jean Paul Serrato Violeth  
- **Licencia:** UNLICENSED (uso privado)

---

## Contribuir

1. Clona el repo y configura el entorno según *Inicio rápido*.
2. Crea una rama para tu cambio.
3. Asegura que los tests pasen: `npm run test:e2e` (con DB y Redis levantados).
4. Abre un Pull Request contra `main`.
