# 🔒 Hardening de Seguridad

**Fecha:** 2026-02-16  
**Estado:** Implementado

---

## 📋 Índice

1. [Headers de Seguridad HTTP](#headers-de-seguridad-http)
2. [Rate Limiting](#rate-limiting)
3. [Validaciones de Entrada](#validaciones-de-entrada)
4. [Autenticación y Autorización](#autenticación-y-autorización)
5. [Encriptación de Datos](#encriptación-de-datos)
6. [Auditoría y Logging](#auditoría-y-logging)

---

## 🛡️ Headers de Seguridad HTTP

### Headers Implementados

El sistema incluye los siguientes headers de seguridad en todas las respuestas HTTP:

#### 1. X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
**Propósito:** Previene MIME type sniffing, forzando al navegador a respetar el Content-Type declarado.

#### 2. X-Frame-Options
```
X-Frame-Options: DENY
```
**Propósito:** Previene clickjacking al prohibir que la página sea embebida en iframes.

#### 3. X-XSS-Protection
```
X-XSS-Protection: 1; mode=block
```
**Propósito:** Activa la protección básica contra XSS del navegador (legacy pero útil).

#### 4. Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
**Propósito:** Controla qué información del referrer se envía en requests.

#### 5. Permissions-Policy
```
Permissions-Policy: geolocation=(), microphone=(), camera=()
```
**Propósito:** Desactiva APIs del navegador que no son necesarias para la aplicación.

#### 6. Content-Security-Policy (CSP)

**Producción:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;
```

**Desarrollo:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http://localhost:* ws://localhost:* ws:;
```

**Propósito:** Política de seguridad de contenido que controla qué recursos puede cargar la página.

#### 7. Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
**Propósito:** Fuerza conexiones HTTPS. Solo se aplica en producción con HTTPS.

#### 8. X-Powered-By
**Removido:** Se elimina el header `X-Powered-By` para ocultar información del servidor.

---

## 🚦 Rate Limiting

### Configuración Actual

El sistema implementa rate limiting con múltiples estrategias:

#### 1. Rate Limiting Global
- **Short:** 1000 req/min
- **Medium:** 5000 req/10min
- **Long:** 20000 req/hora

#### 2. Rate Limiting por Endpoint
- **Login:** 50 req/min por IP
- **Forgot Password:** 3 req/15min por email
- **Reports:** 30 req/min por tenant
- **Export:** 10 req/min por tenant

#### 3. Rate Limiting por Plan
- **Básico:** 100 req/min
- **Pro:** 1000 req/min
- **Enterprise:** 5000 req/min

**Implementación:** `apps/api/src/common/guards/throttle-auth.guard.ts`

---

## ✅ Validaciones de Entrada

### Validaciones Implementadas

1. **DTOs con class-validator:**
   - Validación automática de tipos y formatos
   - Mensajes de error claros

2. **Límites de Negocio:**
   - Inventario: MIN/MAX cantidad
   - Caja: MIN/MAX montos
   - Ventas/Cotizaciones: MAX items, MAX cantidad por item

3. **Validación de Plan:**
   - Límite de usuarios por plan
   - Validación de módulos habilitados

**Servicios:**
- `ValidationLimitsService`: Límites configurables
- `PlanLimitsService`: Límites por plan

---

## 🔐 Autenticación y Autorización

### Implementación Actual

1. **Autenticación:**
   - JWT con expiración configurable (default: 18 horas)
   - Refresh tokens para renovación
   - Argon2 para hash de contraseñas

2. **Autorización:**
   - RBAC (Roles y Permisos)
   - Guards: `JwtAuthGuard`, `PermissionsGuard`, `ModulesGuard`
   - Multi-tenant isolation automática

3. **Protección de Endpoints:**
   - `@UseGuards(JwtAuthGuard, PermissionsGuard)`
   - `@RequirePermission('resource:action')`
   - `@RequireModule('module_code')`

---

## 🔒 Encriptación de Datos

### Implementación Actual

1. **Contraseñas:**
   - ✅ Argon2 (hash, no encriptación reversible)
   - Salt automático

2. **Certificados DIAN:**
   - ✅ Encriptación con `DIAN_CERT_ENCRYPTION_KEY`
   - Validación de formato y expiración

3. **Datos Sensibles:**
   - JWT secrets en variables de entorno
   - Database credentials en variables de entorno
   - Stripe keys en variables de entorno

---

## 📝 Auditoría y Logging

### Implementación Actual

1. **AuditLog:**
   - Registro de acciones críticas
   - Cadena de integridad (previousHash/entryHash)
   - Metadata completa (IP, userAgent, requestId)

2. **Logging Estructurado:**
   - JSON logging opcional (`LOG_FORMAT=json`)
   - Niveles: error, warn, log, debug
   - Contexto por módulo

3. **Trazabilidad:**
   - Request ID en headers (`X-Request-Id`)
   - Correlation ID para debugging

---

## 🔍 Verificación de Seguridad

### Checklist de Producción

- [x] Headers de seguridad HTTP configurados
- [x] Rate limiting implementado
- [x] Validaciones de entrada robustas
- [x] Autenticación JWT segura
- [x] Autorización RBAC implementada
- [x] Multi-tenant isolation verificada
- [x] Contraseñas hasheadas con Argon2
- [x] Certificados DIAN encriptados
- [x] Secrets en variables de entorno
- [x] Auditoría de acciones críticas
- [x] Logging estructurado
- [x] CORS configurado correctamente
- [x] Validación de variables de entorno al inicio

### Recomendaciones Adicionales

1. **HTTPS Obligatorio:**
   - Configurar SSL/TLS en producción
   - Redirigir HTTP a HTTPS

2. **Rotación de Secrets:**
   - Rotar JWT secrets periódicamente
   - Rotar `DIAN_CERT_ENCRYPTION_KEY` si es necesario

3. **Monitoreo de Seguridad:**
   - Alertas por intentos de acceso fallidos
   - Monitoreo de rate limits excedidos
   - Alertas por errores 5xx

4. **Backups Seguros:**
   - Encriptar backups antes de almacenar
   - Verificar integridad de backups regularmente

---

## 🔗 Referencias

- Headers de seguridad: `apps/api/src/main.ts`
- Rate limiting: `apps/api/src/common/guards/throttle-auth.guard.ts`
- Validaciones: `apps/api/src/common/services/validation-limits.service.ts`
- Plan limits: `apps/api/src/common/services/plan-limits.service.ts`
- Auditoría: `apps/api/src/common/services/audit.service.ts`

---

**Última actualización:** 2026-02-16
