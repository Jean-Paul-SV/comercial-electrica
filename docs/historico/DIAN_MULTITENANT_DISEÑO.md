# Diseño DIAN multi-tenant – Modelo de datos y API

> **Objetivo:** Configuración de facturación electrónica DIAN **por empresa (tenant)** en Orion: datos, certificado cifrado y endpoints.  
> **Complementa:** análisis en el chat (certificados por tenant, flujo, UX, modelo de negocio).

---

## 1. Modelo de datos (DianConfig)

### Campos en Prisma (actualizado)

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `id` | UUID | Sí | PK |
| `tenantId` | UUID | Sí | FK Tenant; único por tenant |
| `env` | DianEnvironment | Sí | HABILITACION \| PRODUCCION |
| `issuerNit` | String? | No* | NIT del emisor (empresa). *Requerido para envío real. |
| `issuerName` | String? | No* | Razón social del emisor. *Requerido para envío real. |
| `softwareId` | String? | No* | ID del software ante la DIAN. *Requerido para envío. |
| `softwarePin` | String? | No* | PIN del software. *Requerido. En producción cifrar (ver §2). |
| `resolutionNumber` | String? | No | Número de resolución de facturación |
| `prefix` | String? | No | Prefijo (FAC, FV, etc.) |
| `rangeFrom` / `rangeTo` | Int? | No | Rango autorizado de numeración |
| `certEncrypted` | String? (Text) | No | .p12 cifrado en base64 (ver §2) |
| `certPasswordEncrypted` | String? (Text) | No | Contraseña del .p12 cifrada en base64 |
| `certValidUntil` | DateTime? | No | Fecha de vencimiento del certificado (cacheada) |
| `createdAt` / `updatedAt` | DateTime | Sí | Auditoría |

Relación: **1 Tenant → 1 DianConfig** (`@@unique([tenantId])`).

---

## 2. Almacenamiento seguro de secretos

### Opción A: Cifrado en base de datos (implementación inicial)

- **Clave de cifrado:** Variable de entorno `DIAN_CERT_ENCRYPTION_KEY` (32 bytes en base64 o hex para AES-256). En producción, inyectar desde un gestor de secretos (AWS Secrets Manager, Vault, etc.).
- **Algoritmo:** AES-256-GCM (recomendado) o AES-256-CBC con IV por valor.
- **Qué se cifra:**
  - Contenido binario del .p12 → cifrado → codificar en base64 → `certEncrypted`.
  - Contraseña del .p12 → cifrado → base64 → `certPasswordEncrypted`.
- **Uso:** Al procesar una factura del tenant, el servicio obtiene `DianConfig`, descifra certificado y contraseña en memoria, firma el XML y no persiste los valores en claro.

### Opción B (futura): Gestor de secretos externo

- En lugar de `certEncrypted` / `certPasswordEncrypted`, guardar una referencia (ej. `certSecretId` = ARN o path en Vault).
- La API resuelve el secreto por `tenantId` en tiempo de ejecución. Misma lógica de uso; solo cambia el origen del certificado y la contraseña.

### Buenas prácticas

- No loguear ni devolver nunca PIN, contraseña del certificado ni contenido del .p12.
- En GET de configuración no exponer `softwarePin`, `certEncrypted`, `certPasswordEncrypted`; sí indicar “certificado cargado” / “PIN configurado” (boolean o máscara).

---

## 3. Estado de configuración DIAN por tenant

El sistema debe exponer un **estado** calculado para la UX y para decidir si se puede enviar a la DIAN.

### Valores de estado

| Estado | Condición | Comportamiento |
|--------|-----------|----------------|
| `not_configured` | No existe DianConfig para el tenant o no hay ningún dato útil | No permitir envío; CTA “Configurar facturación electrónica”. |
| `incomplete` | Falta al menos uno: issuerNit, issuerName, softwareId, softwarePin, certificado (certEncrypted + certPasswordEncrypted) | Mostrar “Qué falta” (sin revelar secretos). No enviar. |
| `cert_expired` | certValidUntil &lt; ahora | Bloquear envío; mensaje “Renueve su certificado”. |
| `range_exhausted` | Próximo número a usar &gt; rangeTo | Bloquear nuevas facturas electrónicas. |
| `ready` | Todo completo, certificado vigente, rango disponible | Permitir emisión. |

### Cálculo del estado (lógica sugerida en backend)

1. Si no hay `DianConfig` o está “vacío” → `not_configured`.
2. Si falta issuerNit, issuerName, softwareId, softwarePin, o (certEncrypted + certPasswordEncrypted) → `incomplete`.
3. Si `certValidUntil` existe y `certValidUntil < now()` → `cert_expired`.
4. Si el próximo número de factura del tenant &gt; `rangeTo` → `range_exhausted`.
5. En caso contrario → `ready`.

El endpoint de estado devolverá también `missing: string[]` (ej. `['issuer_nit','certificate']`) para guiar al usuario, sin incluir valores secretos.

---

## 4. Endpoints de la API (por tenant)

El **tenantId** se obtiene del JWT (usuario autenticado); todos los endpoints están en el contexto del tenant del usuario.

### 4.1 GET `/dian/config` (o `GET /tenants/me/dian-config`)

- **Descripción:** Obtiene la configuración DIAN del tenant actual **sin secretos**.
- **Respuesta (ejemplo):**
  - `env`, `issuerNit`, `issuerName`, `softwareId` (puede ocultarse parcialmente si se desea), `resolutionNumber`, `prefix`, `rangeFrom`, `rangeTo`, `certValidUntil`.
  - **No incluir:** `softwarePin`, `certEncrypted`, `certPasswordEncrypted`.
  - Flags útiles: `hasCert: boolean`, `hasSoftwarePin: boolean` (para mostrar “Configurado” en la UI).
- **Si no hay config:** 200 con `null` o objeto vacío según convención del API.

### 4.2 GET `/dian/config-status` (por tenant)

- **Descripción:** Estado de la configuración para el tenant actual (listo para enviar o qué falta).
- **Respuesta (ejemplo):**
  - `status`: `not_configured` | `incomplete` | `cert_expired` | `range_exhausted` | `ready`.
  - `readyForSend`: boolean (true solo si `status === 'ready'`).
  - `missing`: string[] (ej. `['issuer_nit','issuer_name','software_id','software_pin','certificate']`).
  - `hasCert`, `hasIssuerData`: boolean.
  - Opcional: `certValidUntil`, `nextNumber`, `rangeTo`.
- **Nota:** El controlador actual `GET /dian/config-status` debe pasar a usar `tenantId` del JWT y leer DianConfig del tenant (no variables de entorno globales).

### 4.3 PUT o PATCH `/dian/config`

- **Descripción:** Crea o actualiza la configuración DIAN del tenant (solo datos no secretos).
- **Body:** issuerNit, issuerName, env, softwareId, softwarePin (opcional en PATCH), resolutionNumber, prefix, rangeFrom, rangeTo.
- **Validación:** No permitir rangeFrom &gt; rangeTo; formato NIT según reglas DIAN.
- **Seguridad:** Si se envía `softwarePin`, almacenar cifrado si ya se implementa cifrado para PIN; si no, almacenar en claro y documentar que en producción se debe cifrar.

### 4.4 POST `/dian/config/certificate`

- **Descripción:** Subida del certificado .p12 y su contraseña para el tenant.
- **Body:** Por ejemplo `{ certBase64: string, password: string }` (certBase64 = contenido del .p12 en base64).
- **Comportamiento:**
  - Validar que el .p12 se pueda abrir con la contraseña.
  - Opcional: validar que el NIT del certificado coincida con `issuerNit` del DianConfig.
  - Leer fecha de vencimiento y guardar en `certValidUntil`.
  - Cifrar .p12 y contraseña; guardar en `certEncrypted` y `certPasswordEncrypted`.
  - No devolver nunca el certificado ni la contraseña.
- **Si no existe DianConfig:** Crear uno mínimo (solo tenantId) o exigir que primero exista config (PUT /dian/config) y luego subir certificado.

### 4.5 Endpoints existentes que deben usar tenant

- **GET `/dian/documents/:id/status`:** Ya usa `req.user.tenantId` y aislamiento por tenant. Mantener.
- Cualquier otro endpoint que lea o escriba DianConfig o procese documentos debe filtrar/asociar por `tenantId` del JWT (o del documento).

---

## 5. Resumen de pasos de implementación (referencia)

1. **Schema:** DianConfig con issuerNit, issuerName, certEncrypted, certPasswordEncrypted, certValidUntil; softwareId/softwarePin opcionales. ✅ Hecho en este diseño.
2. **Migración:** Aplicar la migración `20260211000000_dian_config_multitenant_cert_issuer` desde `apps/api`: `npx prisma migrate deploy` (o `migrate dev` con la base de datos en marcha).
3. **Servicio de cifrado:** Utilidad para cifrar/descifrar con `DIAN_CERT_ENCRYPTION_KEY` (AES-256).
4. **Servicio de configuración:** getDianConfigForTenant(tenantId), getConfigStatusForTenant(tenantId), upsertConfig(tenantId, data), saveCertificate(tenantId, certBase64, password).
5. **Controladores:** Implementar o adaptar GET/PATCH /dian/config, GET /dian/config-status (por tenant), POST /dian/config/certificate.
6. **DianService (procesamiento):** En processDocument, obtener tenantId de la factura, cargar config con getDianConfigForTenant, descifrar certificado y contraseña, generar XML con issuerNit/issuerName del tenant, firmar y enviar con softwareId/softwarePin del tenant.
7. **Worker:** Asegurar que el job tenga acceso al tenantId (desde la factura) y que DianService use solo config de ese tenant.
8. **UX:** Pantalla de configuración por pasos y bloqueos cuando status ≠ ready.

---

## 6. Variables de entorno (referencia)

| Variable | Uso |
|----------|-----|
| `DIAN_CERT_ENCRYPTION_KEY` | Clave para cifrar/descifrar certEncrypted y certPasswordEncrypted (32 bytes, base64 o hex). Obligatoria si se usa cifrado en BD. |
| `DIAN_USE_DEFAULT_URL`, `DIAN_ENV` (global) | Siguen siendo útiles para URLs y timeouts; la config por tenant sobrescribe env, prefijo, rango, NIT, etc. |

Las variables actuales (`DIAN_SOFTWARE_ID`, `DIAN_ISSUER_NIT`, etc.) pueden mantenerse como **fallback** cuando no exista DianConfig para el tenant (modo un solo tenant legacy); en multi-tenant real la fuente de verdad es DianConfig.

---

**Última actualización:** Febrero 2026
