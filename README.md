# Orion

Sistema de gestión integral para ferretería eléctrica: inventario, ventas, caja, clientes, gastos, cotizaciones, proveedores, facturación y reportes. Preparado para facturación electrónica DIAN (Colombia).

**Monorepo:** API (NestJS) + Web (Next.js) · PostgreSQL · Redis · Prisma

---

## Estado del proyecto (Febrero 2026)

| Área        | Estado |
|------------|--------|
| **API**    | ✅ Operativa (auth, catálogo, ventas, caja, cotizaciones, inventario, proveedores, reportes, auditoría, backups, billing, provider) |
| **Frontend** | ✅ Next.js operativo (dashboard, ventas, productos, clientes, caja, gastos, cotizaciones, proveedores, compras, reportes, auditoría, configuración, billing) |
| **DIAN**   | ✅ Implementado a nivel de código (XML UBL 2.1, firma digital, envío, CUFE, PDF/QR); falta solo validar en habilitación/producción con credenciales reales de DIAN. |

Documentos de referencia: [`docs/ESTADO_PROYECTO.md`](./docs/ESTADO_PROYECTO.md) y [`docs/IMPLEMENTACIONES_PRODUCCION.md`](./docs/IMPLEMENTACIONES_PRODUCCION.md)

---

## Qué tengo que hacer yo (checklist)

Este checklist es para **ti como usuario/propietario del proyecto** (sin tocar código).  
Marca cada punto cuando lo tengas listo en tu entorno real.

### 1. Preparar entorno y despliegue

- [ ] Elegir proveedor para **API + PostgreSQL + Redis** y para la **web** (por ejemplo Render + Vercel).
- [ ] Configurar las variables de entorno base en producción (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, `ALERT_WEBHOOK_SECRET`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `NEXT_PUBLIC_API_BASE_URL`).
- [ ] Seguir `docs/DEPLOY.md` para hacer el primer despliegue y comprobar:
  - [ ] `GET /health` OK en la API.
  - [ ] La web carga y puedes iniciar sesión.

### 2. DIAN (solo si vas a facturar electrónicamente en Colombia)

- [ ] Conseguir con tu contable/DIAN:
  - Certificado `.p12` de firma.
  - Software ID, PIN, NIT emisor y usuario DIAN.
- [ ] Configurar las variables `DIAN_*` en el entorno de **habilitación**.
- [ ] Emitir al menos **una factura de prueba** desde Orion en habilitación y verificar:
  - [ ] Respuesta “aceptada” de DIAN.
  - [ ] CUFE correcto.
  - [ ] PDF con QR generado.
- [ ] Repetir el proceso con credenciales de **producción DIAN**.

### 3. Seguridad, backups y monitoreo

- [ ] Configurar **backups automáticos** de la base de datos (según tu proveedor).
- [ ] Probar una **restauración** en un entorno de pruebas siguiendo `docs/BACKUP_RESTORE_ESTRATEGIA.md`.
- [ ] Configurar Redis de producción y `REDIS_URL`.
- [ ] Configurar canales de **alertas** (Slack, email, webhook) siguiendo `docs/ALERTAS_CONFIGURACION.md` y enviar una alerta de prueba.
- [ ] Ejecutar las **pruebas manuales de seguridad** de `docs/PRUEBAS_MANUALES_SEGURIDAD.md` en tu entorno (logs sin datos sensibles, errores sin UUIDs, etc.).
- [ ] Verificar que `/metrics` y `/health` están integrados en tu sistema de monitoreo/dashboards.

### 4. Negocio y soporte

- [ ] Definir el **canal de soporte** (WhatsApp/email/teléfono) y los **tiempos de respuesta** que vas a ofrecer a tus clientes.
- [ ] Configurar el botón de soporte en la web (`NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER` y mensaje opcional).
- [ ] Definir **planes y precios** y configurarlos en Stripe y en el panel proveedor.
- [ ] Redactar el **contrato/licencia** de uso del servicio (alcance, SLA, cancelación, etc.).
- [ ] (Opcional) Configurar dominio propio (`app.tuempresa.com`, `api.tuempresa.com`) y actualizar `ALLOWED_ORIGINS` / `FRONTEND_URL`.

### 5. Alta de clientes y operación día a día

- [ ] Seguir `docs/RUNBOOK_ALTA_CLIENTE.md` cada vez que des de alta una nueva empresa (tenant).
- [ ] Revisar mensualmente que los **backups** se están generando y que puedes restaurar.
- [ ] Revisar que las **alertas** siguen llegando (hacer prueba cada cierto tiempo).
- [ ] Revisar métricas y uso real para ajustar planes, precios y umbrales de alertas.

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

# Seed: roles/permisos y tenant por defecto
npm run prisma:seed -w api

# Levantar API + Web
npm run dev
```

- **API:** http://localhost:3000  
- **Web:** http://localhost:3001  
- **Swagger:** http://localhost:3000/api/docs  

Login: el correo que configures en `PLATFORM_ADMIN_EMAIL` (Panel proveedor) o, si usas seed completo, `admin@negocio.local` / `AdminNegocio1!`. Ver `docs/PASO_A_PASO_SEED_MI_CORREO.md`.

Guía detallada y solución de problemas: [docs/LEVANTAR_PROYECTO.md](./docs/LEVANTAR_PROYECTO.md).

---

## Después del seed

El único seed del proyecto es el de Prisma (`npm run prisma:seed -w api`): crea plan, permisos, roles y tu usuario de Panel proveedor (si defines `PLATFORM_ADMIN_EMAIL` y `PLATFORM_ADMIN_PASSWORD` en `.env`). Con `SEED_ONLY_PLATFORM_ADMIN=true` la base queda vacía excepto tu usuario. Ver `docs/PASO_A_PASO_SEED_MI_CORREO.md`.

Luego abre **http://localhost:3001** e inicia sesión con tu correo (Panel proveedor) o con el admin del tenant si creaste uno:

| Rol   | Email                | Contraseña |
|-------|----------------------|------------|
| Panel proveedor | el de `PLATFORM_ADMIN_EMAIL` | la de `PLATFORM_ADMIN_PASSWORD` |
| Admin tenant | admin@negocio.local (si no usaste SEED_ONLY_PLATFORM_ADMIN) | AdminNegocio1! |

Con tu usuario de Panel proveedor podrás dar de alta empresas y gestionar planes; con el admin del tenant, operar dentro de cada negocio (Dashboard, Ventas, Productos, Clientes, Caja, etc.).

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
- **Billing (SaaS)** — Suscripciones Stripe, portal de facturación; pagos locales PayU (Colombia)
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

## Redis: ¿qué es y qué tengo que hacer?

**Redis no es la base de datos.** La base de datos es **PostgreSQL** (productos, ventas, usuarios, etc. van ahí).

Redis se usa para:

- **Colas de trabajos (BullMQ):** por ejemplo, procesar documentos DIAN en segundo plano.
- **Caché:** guardar respuestas temporales para que algunas consultas vayan más rápido.

**Qué tienes que hacer:**

- **En local:** Nada especial. Al ejecutar `npm run db:up` se levantan **Postgres y Redis** en Docker. En `.env` deja `REDIS_URL="redis://localhost:6379"`. La API se conecta sola; no tienes que cargar ni crear datos en Redis.
- **En producción:** Contratar o desplegar un Redis (Upstash, Redis Cloud, Redis en tu VPS, etc.) y poner su URL en `REDIS_URL`. Tampoco se “sube” la base de datos a Redis: los datos de negocio siguen en PostgreSQL.

---

## Documentación

- [**Pasos para subir a producción**](./docs/PASOS_SUBIR_PRODUCCION.md) — Checklist y orden recomendado para desplegar
- [**Paso a paso: seed con mi correo**](./docs/PASO_A_PASO_SEED_MI_CORREO.md) — Configurar el primer usuario (plataforma y tenant)
- [Despliegue](./docs/DEPLOY.md) — Cómo desplegar API y web
- [Migrar a mi dominio (Hostinger)](./docs/MIGRAR_A_MI_DOMINIO_HOSTINGER.md) — Dominio propio y panel proveedor
- [Estado del proyecto](./docs/ESTADO_PROYECTO.md) — Resumen ejecutivo y estado final
- [Checklist seguridad y siguientes pasos](./docs/CHECKLIST_SEGURIDAD_Y_SIGUIENTES_PASOS.md) — Qué revisar antes de producción
- [Qué sigue / roadmap](./docs/QUE_SIGUE.md) — Visión de siguientes pasos
- [Troubleshooting](./docs/TROUBLESHOOTING.md) — Errores frecuentes y soluciones
- [Índice de documentación](./docs/historico/README.md) — Más documentación en `docs/` y `docs/historico/`

---

## Próximos pasos

1. Completar el checklist de la sección **“Qué tengo que hacer yo”** en tu entorno real (especialmente DIAN si facturas en Colombia).
2. Configurar backups, monitoreo y alertas siguiendo la documentación enlazada.
3. Para cualquier cambio futuro en el código, usar `docs/CHECKLIST_SEGURIDAD_Y_SIGUIENTES_PASOS.md` y `.github/SECURITY_CHECKLIST.md` como guía.

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
