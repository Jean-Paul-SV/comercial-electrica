# Guía: Validación DIAN en Habilitación (Multi-Tenant)

**Prioridad:** 🔴 **CRÍTICO**  
**Tiempo estimado:** 2-3 semanas por tenant  
**Objetivo:** Validar que la facturación electrónica funciona correctamente con DIAN antes de producción

---

## ⚠️ Por qué es crítico

Sin validación en habilitación DIAN:
- ❌ **Riesgo legal:** Facturas pueden ser rechazadas en producción
- ❌ **Riesgo regulatorio:** DIAN puede sancionar por formato incorrecto
- ❌ **Riesgo de negocio:** Si DIAN rechaza facturas, clientes cancelan

**Impacto:** Un error en formato XML puede causar rechazo masivo de facturas y pérdida de clientes.

---

## 🏢 Modelo Multi-Tenant

**IMPORTANTE:** Este sistema usa configuración DIAN **por tenant**. Cada empresa (tenant) debe:

1. ✅ Obtener sus propias credenciales DIAN
2. ✅ Configurar su propio certificado .p12
3. ✅ Activar su servicio DIAN independientemente

**No hay certificado global** - cada tenant gestiona su propia configuración DIAN.

---

## 📋 Requisitos Previos (Por Tenant)

### 1. Credenciales DIAN Habilitación (Por Tenant)

Cada tenant necesita obtener:
- ✅ **Software ID:** ID del software registrado en DIAN (del tenant)
- ✅ **Software PIN:** PIN del software (del tenant)
- ✅ **NIT:** NIT de la empresa del tenant
- ✅ **Certificado .p12:** Certificado de firma electrónica del tenant (válido)
- ✅ **Contraseña del certificado:** Contraseña del archivo .p12 del tenant

**Cómo obtener (proceso por tenant):**
1. El tenant se registra en [DIAN](https://www.dian.gov.co/)
2. Solicita habilitación como proveedor de facturación electrónica
3. Registra el software (puede usar el mismo Software ID si es el mismo proveedor)
4. Obtiene su certificado de firma electrónica

**Tiempo estimado:** 1-2 semanas por tenant (proceso gubernamental)

**Nota:** Si eres el proveedor del software, puedes ayudar a los tenants con el proceso, pero cada uno debe obtener sus propias credenciales.

---

## 🔧 Configuración en el Sistema (Multi-Tenant)

### Paso 1: Configurar Variables de Entorno Globales

**Solo necesitas configurar la clave de cifrado** (para proteger certificados en BD):

```env
# Multi-tenant: clave de cifrado para certificados por tenant (OBLIGATORIA)
# Genera una clave de 32 bytes (64 caracteres hex o base64)
DIAN_CERT_ENCRYPTION_KEY=tu_clave_de_32_bytes_en_hex_o_base64

# Ambiente DIAN por defecto (los tenants pueden sobrescribir)
DIAN_ENV=HABILITACION

# URLs por defecto (opcional, los tenants pueden usar su propia config)
DIAN_USE_DEFAULT_URL=true
```

**⚠️ IMPORTANTE:** `DIAN_CERT_ENCRYPTION_KEY` es **obligatoria** para el modelo multi-tenant. Sin ella, no se pueden cifrar los certificados de los tenants.

**Generar clave de cifrado:**
```bash
# Opción 1: Usar OpenSSL
openssl rand -hex 32

# Opción 2: Usar Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Paso 2: Configurar DIAN por Tenant (Desde la UI o API)

**Cada tenant configura su propia información DIAN:**

#### Opción A: Desde la UI (Recomendado)

1. El tenant inicia sesión en su cuenta
2. Va a **Configuración → Facturación Electrónica**
3. Completa el formulario con:
   - **NIT:** NIT de su empresa
   - **Razón Social:** Nombre de su empresa
   - **Software ID:** Su Software ID de DIAN
   - **Software PIN:** Su PIN de DIAN
   - **Ambiente:** HABILITACION (para pruebas)
   - **Certificado .p12:** Sube su archivo certificado
   - **Contraseña del certificado:** Contraseña del .p12

#### Opción B: Desde la API

**Endpoint:** `PATCH /dian/config`

```bash
curl -X PATCH https://TU-API/dian/config \
  -H "Authorization: Bearer TOKEN_DEL_TENANT" \
  -H "Content-Type: application/json" \
  -d '{
    "issuerNit": "900123456-7",
    "issuerName": "Empresa del Tenant S.A.S.",
    "softwareId": "software_id_del_tenant",
    "softwarePin": "pin_del_tenant",
    "env": "HABILITACION"
  }'
```

**Subir certificado:** `POST /dian/config/certificate`

```bash
curl -X POST https://TU-API/dian/config/certificate \
  -H "Authorization: Bearer TOKEN_DEL_TENANT" \
  -H "Content-Type: application/json" \
  -d '{
    "certBase64": "MIIKpAIBAzCCCl4GCSqGSIb3...",
    "password": "password_del_certificado"
  }'
```

**Convertir certificado a base64:**
```bash
# Linux/Mac
cat certificado.p12 | base64

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.p12"))
```

---

### Paso 3: Verificar Configuración del Tenant

**Endpoint:** `GET /dian/config-status`

```bash
curl https://TU-API/dian/config-status \
  -H "Authorization: Bearer TOKEN_DEL_TENANT"
```

**Respuesta esperada:**
```json
{
  "status": "ready",
  "hasConfig": true,
  "hasCertificate": true,
  "certValidUntil": "2026-12-31T23:59:59Z",
  "env": "HABILITACION",
  "issuerNit": "900123456-7",
  "issuerName": "Empresa del Tenant S.A.S."
}
```

**Estados posibles:**
- `pending`: Tenant no ha configurado DIAN aún
- `incomplete`: Falta configuración o certificado
- `ready`: Todo configurado y listo para usar
- `expired`: Certificado vencido

---

## 🧪 Pruebas en Habilitación (Por Tenant)

### Prueba 1: Verificar Configuración del Tenant

**Antes de probar facturas, verifica que el tenant tiene todo configurado:**

```bash
# Obtener estado de configuración
curl https://TU-API/dian/config-status \
  -H "Authorization: Bearer TOKEN_DEL_TENANT"
```

**Debe mostrar:**
- ✅ `status: "ready"`
- ✅ `hasConfig: true`
- ✅ `hasCertificate: true`
- ✅ `certValidUntil` en el futuro
- ✅ `issuerNit` y `issuerName` configurados

---

### Prueba 2: Generar XML Básico

1. **El tenant crea una factura de prueba** en el sistema
2. **Generar factura electrónica** (sin enviar aún)
3. **Verificar XML generado:**
   - Formato UBL 2.1 correcto
   - Campos obligatorios presentes
   - NITs y datos del emisor del tenant correctos
   - Certificado del tenant usado para firmar

**Comando para ver XML:**
```bash
# En logs del sistema, buscar "XML generado" o revisar BD
# El XML debe tener el NIT y razón social del tenant, no valores globales
```

---

### Prueba 3: Firmar XML con Certificado del Tenant

1. **El sistema firma el XML** con el certificado .p12 del tenant
2. **Verificar firma:**
   - Firma digital presente
   - Certificado del tenant válido (no vencido)
   - Formato de firma correcto
   - NIT del certificado coincide con `issuerNit` del tenant

**Validación:**
- El XML debe tener `<Signature>` válido
- El certificado del tenant debe estar vigente
- El NIT del certificado debe coincidir con el NIT configurado

---

### Prueba 4: Enviar a DIAN Habilitación

1. **Enviar factura a DIAN habilitación** (usando credenciales del tenant)
2. **Verificar respuesta:**
   - Estado: `ACCEPTED` o `REJECTED`
   - CUFE generado (si aceptada)
   - Mensaje de error (si rechazada)
   - Software ID y PIN del tenant usados correctamente

**Endpoints DIAN:**
- **Habilitación:** `https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc`
- **Producción:** `https://vpfe.dian.gov.co/WcfDianCustomerServices.svc`

**⚠️ IMPORTANTE:** El sistema usa las credenciales (`softwareId`, `softwarePin`) del tenant, no credenciales globales.

---

### Prueba 5: Consultar Estado (GetStatus)

1. **Obtener CUFE** de factura aceptada
2. **Consultar estado** usando GetStatus (con credenciales del tenant)
3. **Verificar respuesta:**
   - Estado coincide con respuesta inicial
   - Datos del documento correctos
   - Consulta usa `softwareId` y `softwarePin` del tenant

---

### Prueba 6: Generar PDF y QR

1. **Generar PDF** de factura aceptada
2. **Verificar:**
   - PDF contiene todos los datos del tenant
   - QR code presente y escaneable
   - CUFE visible en PDF
   - NIT y razón social del tenant correctos

---

## ✅ Checklist de Validación (Por Tenant)

### Validación de Configuración del Tenant

- [ ] Tenant tiene cuenta creada en el sistema
- [ ] Tenant configuró su NIT y razón social
- [ ] Tenant configuró su Software ID y PIN de DIAN
- [ ] Tenant subió su certificado .p12
- [ ] Certificado del tenant no está vencido
- [ ] Estado de configuración muestra `ready`
- [ ] `DIAN_CERT_ENCRYPTION_KEY` configurada en servidor

### Validación Técnica

- [ ] XML generado en formato UBL 2.1 correcto
- [ ] Firma digital válida con certificado del tenant
- [ ] Certificado del tenant no vencido
- [ ] Envío a DIAN habilitación exitoso (con credenciales del tenant)
- [ ] Respuesta DIAN procesada correctamente
- [ ] CUFE generado y almacenado
- [ ] GetStatus funciona correctamente (con credenciales del tenant)
- [ ] PDF generado con QR válido

### Validación de Datos

- [ ] NIT del emisor coincide con NIT del tenant
- [ ] Razón social del emisor coincide con tenant
- [ ] NITs correctos (emisor y cliente)
- [ ] Numeración consecutiva válida
- [ ] Fechas correctas
- [ ] Montos y cálculos correctos
- [ ] Impuestos calculados correctamente (IVA 19%)
- [ ] Datos del cliente completos

### Validación de Flujo Completo

- [ ] Tenant configura DIAN desde UI/API
- [ ] Crear venta → Generar factura → Enviar a DIAN → Aceptada
- [ ] Consultar estado después de envío (usa credenciales del tenant)
- [ ] Generar PDF después de aceptación
- [ ] Manejo de errores (factura rechazada)
- [ ] Reintento automático si falla envío
- [ ] Múltiples tenants pueden usar DIAN simultáneamente sin conflictos

---

## 🚨 Errores Comunes y Soluciones

### Error: "Certificado vencido"

**Causa:** El certificado .p12 del tenant está vencido.

**Solución:**
1. El tenant renueva su certificado en DIAN
2. El tenant sube el nuevo certificado desde la UI (`POST /dian/config/certificate`)
3. El sistema valida automáticamente y actualiza `certValidUntil`
4. Verificar estado con `GET /dian/config-status`

---

### Error: "Tenant no tiene configuración DIAN"

**Causa:** El tenant no ha configurado DIAN aún.

**Solución:**
1. El tenant debe completar la configuración desde la UI
2. Verificar que `GET /dian/config-status` muestra `status: "ready"`
3. Asegurar que todos los campos requeridos están completos

---

### Error: "Certificado no coincide con NIT del tenant"

**Causa:** El certificado .p12 tiene un NIT diferente al configurado en `issuerNit`.

**Solución:**
1. Verificar que el certificado pertenece al tenant correcto
2. Actualizar `issuerNit` en la configuración para que coincida con el certificado
3. O usar el certificado correcto que coincida con el NIT configurado

---

### Error: "Formato XML inválido"

**Causa:** El XML no cumple con UBL 2.1 o tiene campos faltantes.

**Solución:**
1. Revisar logs para ver qué campo falta
2. Validar XML contra esquema UBL 2.1
3. Verificar que todos los campos obligatorios están presentes

---

### Error: "NIT no encontrado"

**Causa:** El NIT del cliente no está registrado en DIAN o es inválido.

**Solución:**
1. Verificar NIT del cliente en RUT DIAN
2. Validar formato de NIT (ej: 900123456-7)
3. Usar NIT de prueba en habilitación si es necesario

---

### Error: "Rango de numeración agotado"

**Causa:** Se agotaron los números autorizados por DIAN.

**Solución:**
1. Solicitar nuevo rango a DIAN
2. Actualizar configuración en el sistema
3. Continuar con nuevo rango

---

## 📊 Métricas de Éxito (Por Tenant)

### Objetivo: 10-20 Facturas Exitosas por Tenant

**Criterios por tenant:**
- ✅ Mínimo 10-20 facturas enviadas por tenant
- ✅ Tasa de aceptación >95%
- ✅ Sin errores críticos de formato
- ✅ PDFs generados correctamente
- ✅ QR codes escaneables
- ✅ Configuración independiente funciona correctamente

**Tiempo estimado:** 1-2 semanas de pruebas por tenant

**Para múltiples tenants:**
- ✅ Cada tenant puede configurar DIAN independientemente
- ✅ No hay conflictos entre certificados de diferentes tenants
- ✅ Cada tenant usa sus propias credenciales correctamente

---

## 📝 Documentación Requerida

### Documentar:

1. **Proceso completo:**
   - Cómo obtener credenciales DIAN
   - Cómo configurar el sistema
   - Cómo probar cada paso

2. **Troubleshooting:**
   - Errores comunes y soluciones
   - Cómo contactar soporte DIAN
   - Procedimientos de escalación

3. **Resultados de pruebas:**
   - Número de facturas probadas
   - Tasa de éxito
   - Errores encontrados y resueltos

---

## 🎯 Próximos Pasos Después de Validación

Una vez validado en habilitación por tenant:

1. **Documentar proceso completo** ✅
2. **Preparar migración a producción (por tenant):**
   - Cada tenant obtiene credenciales producción DIAN
   - Cada tenant actualiza su configuración a `env: PRODUCCION`
   - Cada tenant renueva su certificado si es necesario
   - Probar con cliente real (1-2 facturas por tenant)
3. **Monitoreo intensivo primeros días:**
   - Revisar todas las facturas enviadas por cada tenant
   - Verificar aceptación/rechazo
   - Resolver problemas inmediatamente
   - Monitorear certificados próximos a vencer (sistema automático)

**⚠️ IMPORTANTE:** Cada tenant debe migrar a producción independientemente. No hay migración global.

---

## 📞 Contacto DIAN

**Soporte técnico DIAN:**
- **Email:** soporte@dian.gov.co
- **Teléfono:** Línea nacional (consultar en dian.gov.co)
- **Portal:** [https://www.dian.gov.co](https://www.dian.gov.co)

**Documentación oficial:**
- [Resolución DIAN](https://www.dian.gov.co/normatividad)
- [Guías técnicas DIAN](https://www.dian.gov.co/factura-electronica)

---

---

## 🔄 Proceso de Activación por Tenant

### Flujo Completo

1. **Tenant se registra en Orion**
   - Crea su cuenta
   - Selecciona plan con facturación electrónica

2. **Tenant obtiene credenciales DIAN**
   - Se registra en DIAN
   - Obtiene Software ID y PIN
   - Obtiene certificado .p12

3. **Tenant configura DIAN en Orion**
   - Accede a Configuración → Facturación Electrónica
   - Ingresa NIT, razón social, Software ID, PIN
   - Sube certificado .p12
   - Sistema valida certificado y configuración

4. **Tenant prueba en habilitación**
   - Genera facturas de prueba
   - Envía a DIAN habilitación
   - Valida aceptación

5. **Tenant migra a producción**
   - Actualiza configuración a `env: PRODUCCION`
   - Renueva certificado si es necesario
   - Comienza a facturar en producción

### Ventajas del Modelo Multi-Tenant

- ✅ **Aislamiento:** Cada tenant tiene su propia configuración
- ✅ **Seguridad:** Certificados cifrados por tenant
- ✅ **Escalabilidad:** Nuevos tenants se activan independientemente
- ✅ **Flexibilidad:** Cada tenant puede usar diferentes ambientes (hab/prod)

---

**Última actualización:** Febrero 2026  
**Tiempo total:** 2-3 semanas por tenant  
**Dificultad:** Media-Alta (requiere credenciales gubernamentales por tenant)  
**Modelo:** Multi-tenant (cada tenant configura su propio certificado DIAN)
