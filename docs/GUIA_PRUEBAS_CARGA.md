# Guía: Pruebas de Carga

**Prioridad:** 🟠 **ALTO**  
**Tiempo estimado:** 1 semana  
**Objetivo:** Validar que el sistema puede soportar 100+ tenants concurrentes sin degradación

---

## ⚠️ Por qué es crítico

Sin pruebas de carga:
- ❌ **Riesgo de downtime:** El sistema puede fallar con carga real
- ❌ **Riesgo de escalabilidad:** No sabemos cuántos clientes puede soportar
- ❌ **Riesgo de performance:** Cuellos de botella no identificados
- ❌ **Riesgo de negocio:** Pérdida de clientes por lentitud/errores

**Impacto:** Un sistema lento o que falla bajo carga puede causar churn masivo y pérdida de reputación.

---

## 🎯 Objetivos de las Pruebas

### Objetivos Principales

1. **Validar capacidad:** Sistema debe soportar mínimo 100 tenants concurrentes
2. **Identificar cuellos de botella:** DB, Redis, API, colas
3. **Medir tiempos de respuesta:** P95 < 500ms, P99 < 1s para endpoints críticos
4. **Validar estabilidad:** Sin memory leaks, sin degradación en el tiempo
5. **Probar recuperación:** Sistema debe recuperarse después de picos de carga

### Métricas Clave

- **Throughput:** Requests por segundo (RPS)
- **Latencia:** P50, P95, P99, P100
- **Error rate:** < 1% bajo carga normal, < 5% bajo carga máxima
- **CPU/Memory:** < 80% uso promedio, < 95% pico
- **DB connections:** Pool no agotado
- **Redis:** Sin timeouts ni errores

---

## 🛠️ Herramientas Recomendadas

### Opción 1: k6 (Recomendado)

**Ventajas:**
- ✅ Scripts en JavaScript (fácil de mantener)
- ✅ Métricas en tiempo real
- ✅ Escalable (miles de usuarios virtuales)
- ✅ Integración con InfluxDB/Grafana
- ✅ Gratis y open source

**Instalación:**
```bash
# Windows (con Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D9
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Verificar instalación
k6 version
```

---

### Opción 2: Artillery

**Ventajas:**
- ✅ Configuración YAML (más simple)
- ✅ Bueno para pruebas rápidas
- ✅ Integración con CI/CD

**Instalación:**
```bash
npm install -g artillery
artillery --version
```

---

## 📋 Endpoints Críticos a Probar

### Prioridad 1: Endpoints de Alto Tráfico

| Endpoint | Método | Escenario | RPS Esperado |
|----------|--------|-----------|--------------|
| `/auth/login` | POST | Login simultáneo | 10-50 RPS |
| `/products` | GET | Listar productos | 50-100 RPS |
| `/sales` | GET | Listar ventas | 30-80 RPS |
| `/sales` | POST | Crear venta | 10-30 RPS |
| `/customers` | GET | Listar clientes | 20-50 RPS |
| `/reports/dashboard` | GET | Dashboard principal | 20-40 RPS |

### Prioridad 2: Endpoints de Media Frecuencia

| Endpoint | Método | Escenario | RPS Esperado |
|----------|--------|-----------|--------------|
| `/inventory/movements` | GET | Listar movimientos | 10-30 RPS |
| `/inventory/movements` | POST | Crear movimiento | 5-15 RPS |
| `/cash/sessions` | GET | Listar sesiones | 10-20 RPS |
| `/quotes` | GET | Listar cotizaciones | 10-25 RPS |
| `/quotes` | POST | Crear cotización | 5-15 RPS |

### Prioridad 3: Endpoints de Baja Frecuencia pero Críticos

| Endpoint | Método | Escenario | RPS Esperado |
|----------|--------|-----------|--------------|
| `/dian/documents/:id/status` | GET | Consultar estado DIAN | 1-5 RPS |
| `/billing/stripe` | POST | Webhook Stripe | 1-10 RPS |
| `/backups` | POST | Crear backup | 0.1-1 RPS |

---

## 📝 Scripts de Prueba

### Script 1: k6 - Prueba de Carga Básica

**Archivo:** `scripts/load-test-basic.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Métricas personalizadas
const errorRate = new Rate('errors');

// Configuración
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp-up: 0 a 50 usuarios en 2 min
    { duration: '5m', target: 50 },   // Mantener 50 usuarios por 5 min
    { duration: '2m', target: 100 }, // Escalar a 100 usuarios en 2 min
    { duration: '5m', target: 100 },  // Mantener 100 usuarios por 5 min
    { duration: '2m', target: 0 },    // Ramp-down: reducir a 0 en 2 min
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],                 // < 1% errores
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Datos de prueba (variar por tenant)
const tenants = [
  { email: 'tenant1@test.com', password: 'Test123!' },
  { email: 'tenant2@test.com', password: 'Test123!' },
  // ... más tenants
];

export default function () {
  // Seleccionar tenant aleatorio
  const tenant = tenants[Math.floor(Math.random() * tenants.length)];

  // 1. Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: tenant.email,
    password: tenant.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login has token': (r) => r.json('accessToken') !== undefined,
  });

  if (!loginSuccess) {
    errorRate.add(1);
    return;
  }

  const token = loginRes.json('accessToken');

  // 2. Listar productos
  const productsRes = http.get(`${BASE_URL}/products?page=1&limit=20`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(productsRes, {
    'products status 200': (r) => r.status === 200,
    'products has data': (r) => r.json('data') !== undefined,
  });

  // 3. Listar ventas
  const salesRes = http.get(`${BASE_URL}/sales?page=1&limit=20`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(salesRes, {
    'sales status 200': (r) => r.status === 200,
  });

  // 4. Dashboard
  const dashboardRes = http.get(`${BASE_URL}/reports/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(dashboardRes, {
    'dashboard status 200': (r) => r.status === 200,
  });

  sleep(1); // Simular tiempo de pensamiento del usuario
}
```

**Ejecutar:**
```bash
k6 run scripts/load-test-basic.js --env BASE_URL=http://localhost:3000
```

---

### Script 2: k6 - Prueba de Carga con Escritura

**Archivo:** `scripts/load-test-writes.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp-up a 20 usuarios
    { duration: '5m', target: 20 },   // Mantener 20 usuarios
    { duration: '2m', target: 50 },  // Escalar a 50 usuarios
    { duration: '5m', target: 50 },  // Mantener 50 usuarios
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // Escrituras más lentas
    http_req_failed: ['rate<0.02'],                  // < 2% errores
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Datos de prueba
const tenants = [
  { email: 'tenant1@test.com', password: 'Test123!' },
  // ... más tenants
];

export default function () {
  const tenant = tenants[Math.floor(Math.random() * tenants.length)];

  // Login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: tenant.email,
    password: tenant.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status !== 200) {
    errorRate.add(1);
    return;
  }

  const token = loginRes.json('accessToken');

  // Crear venta
  const saleRes = http.post(`${BASE_URL}/sales`, JSON.stringify({
    customerId: null, // Usar cliente existente o crear uno
    items: [
      {
        productId: 'product-id-here',
        qty: 1,
        unitPrice: 10000,
        taxRate: 19,
      },
    ],
    paymentMethod: 'CASH',
    paidAmount: 11900,
  }), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  check(saleRes, {
    'sale created': (r) => r.status === 201 || r.status === 200,
  });

  sleep(2); // Más tiempo entre escrituras
}
```

---

### Script 3: Artillery - Configuración Simple

**Archivo:** `scripts/artillery-config.yml`

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 120
      arrivalRate: 10
      name: "Ramp-up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 120
      arrivalRate: 100
      name: "Peak load"
    - duration: 120
      arrivalRate: 0
      name: "Ramp-down"
  processor: "./scripts/artillery-processor.js"
  defaults:
    headers:
      Content-Type: "application/json"

scenarios:
  - name: "Login and browse"
    weight: 70
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "{{ $randomString() }}@test.com"
            password: "Test123!"
          capture:
            - json: "$.accessToken"
              as: "token"
      - get:
          url: "/products?page=1&limit=20"
          headers:
            Authorization: "Bearer {{ token }}"
      - get:
          url: "/sales?page=1&limit=20"
          headers:
            Authorization: "Bearer {{ token }}"
      - get:
          url: "/reports/dashboard"
          headers:
            Authorization: "Bearer {{ token }}"

  - name: "Create sale"
    weight: 30
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "{{ $randomString() }}@test.com"
            password: "Test123!"
          capture:
            - json: "$.accessToken"
              as: "token"
      - post:
          url: "/sales"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            customerId: null
            items:
              - productId: "product-id"
                qty: 1
                unitPrice: 10000
                taxRate: 19
            paymentMethod: "CASH"
            paidAmount: 11900
```

**Ejecutar:**
```bash
artillery run scripts/artillery-config.yml
```

---

## 🔍 Métricas a Monitorear

### Métricas del Sistema (API)

**Durante las pruebas, monitorear:**

1. **CPU Usage:**
   ```bash
   # En servidor
   top
   # O con htop
   htop
   ```

2. **Memory Usage:**
   ```bash
   free -h
   # O
   ps aux | grep node
   ```

3. **Database Connections:**
   ```sql
   -- PostgreSQL
   SELECT count(*) FROM pg_stat_activity;
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   ```

4. **Redis Connections:**
   ```bash
   redis-cli INFO clients
   redis-cli CLIENT LIST
   ```

5. **Logs de la API:**
   ```bash
   # Buscar errores, timeouts, slow queries
   tail -f logs/app.log | grep -i "error\|timeout\|slow"
   ```

---

### Métricas de k6/Artillery

**k6 genera automáticamente:**

- `http_req_duration`: Latencia de requests
- `http_req_failed`: Tasa de errores
- `http_reqs`: Requests por segundo
- `vus`: Usuarios virtuales activos
- `iterations`: Iteraciones completadas

**Ejemplo de salida k6:**
```
✓ login status 200
✓ products status 200
✓ sales status 200
✓ dashboard status 200

checks.........................: 100.00% ✓ 4000      ✗ 0
data_received..................: 2.5 MB  8.3 kB/s
data_sent......................: 1.2 MB  4.0 kB/s
http_req_duration..............: avg=245ms min=120ms med=220ms max=850ms p(95)=450ms p(99)=680ms
http_req_failed................: 0.00%   ✓ 0         ✗ 1000
http_reqs......................: 1000    3.3/s
iteration_duration.............: avg=1.2s min=0.8s med=1.1s max=2.5s p(95)=1.8s p(99)=2.2s
iterations.....................: 250     0.83/s
vus............................: 50      min=50      max=50
```

---

## 🎯 Escenarios de Prueba

### Escenario 1: Carga Normal (50 tenants)

**Objetivo:** Validar funcionamiento bajo carga normal

**Configuración:**
- 50 usuarios virtuales simultáneos
- Duración: 10 minutos
- Mix: 70% lectura, 30% escritura

**Criterios de éxito:**
- ✅ P95 < 500ms
- ✅ Error rate < 1%
- ✅ CPU < 70%
- ✅ Memory estable (sin leaks)

---

### Escenario 2: Carga Alta (100 tenants)

**Objetivo:** Validar capacidad máxima esperada

**Configuración:**
- 100 usuarios virtuales simultáneos
- Duración: 15 minutos
- Mix: 60% lectura, 40% escritura

**Criterios de éxito:**
- ✅ P95 < 1000ms
- ✅ Error rate < 2%
- ✅ CPU < 85%
- ✅ Sin degradación progresiva

---

### Escenario 3: Pico de Carga (200 tenants)

**Objetivo:** Identificar límites del sistema

**Configuración:**
- 200 usuarios virtuales simultáneos
- Duración: 5 minutos
- Mix: 50% lectura, 50% escritura

**Criterios de éxito:**
- ✅ P95 < 2000ms (aceptable para pico)
- ✅ Error rate < 5%
- ✅ Sistema se recupera después del pico

---

### Escenario 4: Prueba de Resistencia (50 tenants, 1 hora)

**Objetivo:** Detectar memory leaks y degradación

**Configuración:**
- 50 usuarios virtuales constantes
- Duración: 1 hora
- Mix: 70% lectura, 30% escritura

**Criterios de éxito:**
- ✅ Memory estable (no aumenta progresivamente)
- ✅ Latencia estable (no degrada con el tiempo)
- ✅ Sin errores acumulativos

---

## 🔧 Preparación del Entorno

### Paso 1: Preparar Base de Datos

```bash
# Crear tenants de prueba
cd apps/api
npm run prisma:seed

# O crear script específico para load testing
node scripts/create-load-test-tenants.js
```

**Script ejemplo:** `scripts/create-load-test-tenants.js`

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Crear 100 tenants de prueba
  for (let i = 1; i <= 100; i++) {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Load Test Tenant ${i}`,
        // ... otros campos
      },
    });

    // Crear usuario admin para cada tenant
    await prisma.user.create({
      data: {
        email: `tenant${i}@test.com`,
        password: 'Test123!', // Hash con argon2
        role: 'ADMIN',
        tenantId: tenant.id,
      },
    });

    console.log(`Created tenant ${i}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

### Paso 2: Preparar Datos de Prueba

```bash
# Crear productos, clientes, etc. para cada tenant
node scripts/seed-load-test-data.js
```

---

### Paso 3: Configurar Variables de Entorno

```env
# En .env para pruebas de carga
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
LOG_LEVEL=info
```

---

## 📊 Análisis de Resultados

### Identificar Cuellos de Botella

**1. Database:**

- **Síntoma:** Latencia alta en queries, conexiones agotadas
- **Solución:**
  - Añadir índices faltantes
  - Optimizar queries lentas
  - Aumentar pool de conexiones
  - Considerar read replicas

**2. Redis:**

- **Síntoma:** Timeouts, errores de conexión
- **Solución:**
  - Aumentar maxclients
  - Optimizar uso de memoria
  - Considerar Redis Cluster

**3. API:**

- **Síntoma:** CPU alto, memory leaks
- **Solución:**
  - Optimizar código lento
  - Añadir caching
  - Considerar horizontal scaling

**4. Colas (BullMQ):**

- **Síntoma:** Jobs acumulados, procesamiento lento
- **Solución:**
  - Aumentar workers
  - Optimizar jobs pesados
  - Considerar múltiples queues

---

### Reporte de Resultados

**Template:** `docs/REPORTE_PRUEBAS_CARGA.md`

```markdown
# Reporte: Pruebas de Carga

**Fecha:** [Fecha]
**Versión:** [Versión del sistema]
**Herramienta:** k6 v[X.X.X]

## Escenarios Ejecutados

### Escenario 1: Carga Normal (50 tenants)
- **Duración:** 10 minutos
- **Resultados:**
  - P95: 420ms ✅
  - P99: 680ms ✅
  - Error rate: 0.5% ✅
  - CPU promedio: 65% ✅
  - Memory: Estable ✅

### Escenario 2: Carga Alta (100 tenants)
- **Duración:** 15 minutos
- **Resultados:**
  - P95: 850ms ✅
  - P99: 1.2s ⚠️
  - Error rate: 1.2% ✅
  - CPU promedio: 78% ✅
  - Memory: Estable ✅

## Cuellos de Botella Identificados

1. **Query lenta en `/reports/dashboard`:**
   - Problema: Join complejo sin índice
   - Solución: Añadir índice compuesto en tabla Sales

2. **Pool de conexiones DB agotado:**
   - Problema: Max 20 conexiones, necesitamos 30+
   - Solución: Aumentar a 50 conexiones

## Recomendaciones

1. ✅ Sistema listo para 100 tenants concurrentes
2. ⚠️ Optimizar dashboard antes de escalar a 200+
3. ✅ Considerar read replicas para reportes pesados
```

---

## 🚀 Ejecución Paso a Paso

### Paso 1: Instalar Herramientas

```bash
# Instalar k6
choco install k6  # Windows
# o
brew install k6  # macOS

# Verificar
k6 version
```

---

### Paso 2: Preparar Datos

```bash
cd apps/api

# Crear tenants de prueba
node scripts/create-load-test-tenants.js

# Seed datos de prueba
node scripts/seed-load-test-data.js
```

---

### Paso 3: Iniciar Servidor

```bash
cd apps/api
npm run start:prod

# O con PM2
pm2 start dist/src/main.js --name api
```

---

### Paso 4: Ejecutar Pruebas

```bash
# Prueba básica
k6 run scripts/load-test-basic.js --env BASE_URL=http://localhost:3000

# Prueba con escritura
k6 run scripts/load-test-writes.js --env BASE_URL=http://localhost:3000

# Prueba de resistencia (1 hora)
k6 run scripts/load-test-endurance.js --env BASE_URL=http://localhost:3000
```

---

### Paso 5: Monitorear en Tiempo Real

**Terminal 1:** Ejecutar k6  
**Terminal 2:** Monitorear CPU/Memory
```bash
htop
```

**Terminal 3:** Monitorear DB
```bash
psql -d comercial_electrica -c "SELECT count(*) FROM pg_stat_activity;"
```

**Terminal 4:** Monitorear Redis
```bash
redis-cli MONITOR
```

---

### Paso 6: Analizar Resultados

```bash
# k6 genera reporte en consola
# Guardar salida:
k6 run scripts/load-test-basic.js > results/load-test-$(date +%Y%m%d).log

# O exportar a JSON
k6 run --out json=results/load-test.json scripts/load-test-basic.js
```

---

## ✅ Checklist de Validación

### Antes de Ejecutar

- [ ] k6 instalado y funcionando
- [ ] Base de datos con datos de prueba
- [ ] 100+ tenants creados
- [ ] Servidor API corriendo en producción mode
- [ ] Variables de entorno configuradas
- [ ] Monitoreo configurado (CPU, Memory, DB, Redis)

### Durante las Pruebas

- [ ] Monitorear CPU (< 85%)
- [ ] Monitorear Memory (estable)
- [ ] Monitorear DB connections (pool no agotado)
- [ ] Monitorear Redis (sin timeouts)
- [ ] Revisar logs de errores

### Después de Ejecutar

- [ ] Analizar métricas (P95, P99, error rate)
- [ ] Identificar cuellos de botella
- [ ] Documentar resultados
- [ ] Crear plan de optimización
- [ ] Ejecutar optimizaciones
- [ ] Re-ejecutar pruebas para validar mejoras

---

## 📝 Próximos Pasos

1. **Ejecutar pruebas iniciales** (1 semana)
   - Configurar entorno
   - Ejecutar escenarios básicos
   - Identificar problemas

2. **Optimizar cuellos de botella** (1-2 semanas)
   - Añadir índices
   - Optimizar queries
   - Ajustar configuración

3. **Re-ejecutar pruebas** (3-5 días)
   - Validar mejoras
   - Confirmar objetivos cumplidos

4. **Documentar resultados** (1 día)
   - Crear reporte final
   - Documentar límites del sistema
   - Establecer métricas de monitoreo continuo

---

## 🔗 Referencias

- [k6 Documentation](https://k6.io/docs/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [Redis Performance](https://redis.io/docs/management/optimization/)

---

**Última actualización:** Febrero 2026  
**Tiempo total:** 1 semana  
**Dificultad:** Media-Alta (requiere conocimiento de herramientas y análisis)
