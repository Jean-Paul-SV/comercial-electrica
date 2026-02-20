# Certificado Global DIAN: Configuración y Uso

**Estado actual:** ✅ Soportado con limitaciones  
**Última actualización:** Febrero 2026

---

## 📋 Resumen

El sistema **sí soporta certificado global DIAN**, pero con restricciones importantes:

### ✅ Casos donde SÍ funciona certificado global:

1. **Documentos sin tenant asociado** (modo legacy/un solo tenant)
2. **Consulta de estado (`GetStatus`)** - usa fallback automático
3. **Casos especiales** donde no hay `tenantId` en el documento

### ❌ Casos donde NO funciona como fallback:

1. **Tenants con configuración incompleta** - El sistema requiere que cada tenant tenga su propia configuración completa
2. **Tenants sin configuración** - Si un tenant existe pero no tiene `DianConfig`, el sistema lanza error en lugar de usar certificado global

---

## 🔧 Configuración de Certificado Global

### Variables de Entorno Requeridas

```env
# Certificado global (opcional si todos los tenants tienen su propio certificado)
DIAN_CERT_PATH=./certs/firma-global.p12
# O en base64 (útil en Render/servidores sin disco)
DIAN_CERT_BASE64="MIIKpAIBAzCCCl4GCSqGSIb3..."
DIAN_CERT_PASSWORD=password_del_certificado

# Credenciales globales (opcional)
DIAN_SOFTWARE_ID=tu_software_id_global
DIAN_SOFTWARE_PIN=tu_software_pin_global

# Datos del emisor global (opcional)
DIAN_ISSUER_NIT=900123456-7
DIAN_ISSUER_NAME="Tu Empresa S.A.S."

# Ambiente
DIAN_ENV=HABILITACION
DIAN_USE_DEFAULT_URL=true
```

---

## 🎯 Casos de Uso

### Caso 1: Modo Legacy (Un Solo Tenant)

Si tienes un solo tenant o quieres usar certificado global para todos:

**Configuración:**
- Configura certificado global en variables de entorno
- NO crees `DianConfig` para el tenant
- El sistema usará certificado global automáticamente

**Limitación:** Solo funciona si el documento NO tiene `tenantId` asociado, o si el código permite fallback (actualmente no lo permite para tenants).

---

### Caso 2: Fallback para Consultas de Estado

El sistema **sí usa fallback** para consultas de estado (`GetStatus`):

```typescript
// En syncDocumentStatusFromDian
const tenantConfig = await this.prisma.dianConfig.findUnique({
  where: { tenantId },
  select: { softwareId: true, softwarePin: true },
});

// Fallback automático
const softwareId = tenantConfig?.softwareId?.trim() || this.softwareId;
const softwarePin = tenantConfig?.softwarePin?.trim() || this.softwarePin;
```

**Ventaja:** Si un tenant no tiene `softwareId`/`softwarePin` configurado, usa credenciales globales para consultar estado.

---

### Caso 3: Certificado Global como Fallback para Tenants

**Estado actual:** ❌ **NO soportado**

Si un tenant no tiene certificado configurado, el sistema lanza error en lugar de usar certificado global.

**Código actual (líneas 248-263):**
```typescript
if (tenantId && !useTenant && tenantConfig) {
  throw new BadRequestException(
    'Configuración DIAN del tenant incompleta o certificado vencido...'
  );
}
if (tenantId && !tenantConfig) {
  throw new BadRequestException(
    'No hay configuración DIAN para esta empresa...'
  );
}
```

---

## 🔄 Cómo Habilitar Fallback Global para Tenants

Si quieres permitir que tenants sin configuración usen certificado global como fallback, necesitas modificar `runProcessDocument`:

### Opción 1: Fallback Automático (Recomendado)

Modificar `apps/api/src/dian/dian.service.ts` en `runProcessDocument`:

```typescript
// Línea ~248-263, cambiar de:
if (tenantId && !useTenant && tenantConfig) {
  throw new BadRequestException(
    'Configuración DIAN del tenant incompleta o certificado vencido...'
  );
}
if (tenantId && !tenantConfig) {
  throw new BadRequestException(
    'No hay configuración DIAN para esta empresa...'
  );
}

// A:
if (tenantId && !useTenant) {
  // Intentar usar certificado global como fallback
  if (!this.hasCertConfigured()) {
    throw new BadRequestException(
      'No hay configuración DIAN (ni tenant ni global). Configure facturación electrónica.',
    );
  }
  // Usar certificado global
  this.logger.warn(
    `Tenant ${tenantId} no tiene configuración completa, usando certificado global como fallback`,
  );
  // Continuar con certificado global
}
```

### Opción 2: Flag de Configuración

Añadir una variable de entorno para habilitar fallback:

```env
# Permitir que tenants sin configuración usen certificado global
DIAN_ALLOW_GLOBAL_FALLBACK=true
```

Y modificar la lógica:

```typescript
const allowGlobalFallback = 
  this.config.get<string>('DIAN_ALLOW_GLOBAL_FALLBACK') === 'true';

if (tenantId && !useTenant) {
  if (allowGlobalFallback && this.hasCertConfigured()) {
    this.logger.warn(
      `Tenant ${tenantId} usando certificado global como fallback`,
    );
    // Continuar con certificado global
  } else {
    throw new BadRequestException(
      'Configuración DIAN del tenant incompleta...'
    );
  }
}
```

---

## ⚠️ Consideraciones Importantes

### Ventajas de Certificado Global

- ✅ **Simplicidad:** Un solo certificado para gestionar
- ✅ **Menor costo:** No necesitas certificado por tenant
- ✅ **Onboarding rápido:** Nuevos tenants pueden empezar inmediatamente

### Desventajas de Certificado Global

- ❌ **Riesgo legal:** Si el certificado global pertenece a tu empresa, todas las facturas saldrán a nombre de tu empresa, no del tenant
- ❌ **Cumplimiento:** DIAN requiere que cada empresa facture con su propio certificado
- ❌ **Escalabilidad:** Un solo certificado puede ser cuello de botella
- ❌ **Seguridad:** Si el certificado global se compromete, afecta a todos los tenants

### ⚠️ **IMPORTANTE - Cumplimiento Legal**

**En Colombia, DIAN requiere que cada empresa facture con su propio certificado.** Usar un certificado global para múltiples empresas puede:

- ❌ Violar regulaciones DIAN
- ❌ Causar rechazo de facturas
- ❌ Generar sanciones legales

**Recomendación:** Usa certificado global solo para:
- Pruebas/desarrollo
- Un solo tenant (tu propia empresa)
- Casos especiales donde legalmente está permitido

---

## 📝 Recomendación de Diseño

### ✅ **Modelo Actual (Certificado por Tenant) - RECOMENDADO**

**Tu diseño actual es el correcto para un SaaS multi-tenant real.**

**Ventajas del modelo actual:**
1. ✅ **Cumplimiento legal con DIAN** - Cada empresa factura con su propio certificado (requisito legal)
2. ✅ **Aislamiento de seguridad** - Si un certificado se compromete, solo afecta a ese tenant
3. ✅ **Escalabilidad** - No hay cuello de botella con un solo certificado
4. ✅ **Flexibilidad** - Cada tenant puede usar diferentes ambientes (hab/prod) independientemente
5. ✅ **Independencia** - Los tenants pueden renovar certificados sin afectar a otros
6. ✅ **Modelo de negocio claro** - Cada tenant es responsable de su propia configuración
7. ✅ **Preparado para auditorías** - Cada factura está claramente asociada a su empresa

**Desventajas del modelo actual:**
- ⚠️ Requiere onboarding más complejo (cada tenant debe configurar su certificado)
- ⚠️ Más gestión inicial (ayudar a tenants con configuración)

**Solución a las desventajas:**
- ✅ Crear UI intuitiva para configuración paso a paso
- ✅ Documentación clara (ya la tienes en `GUIA_VALIDACION_DIAN.md`)
- ✅ Soporte durante onboarding
- ✅ Validación automática de certificados

### ❌ Modelo con Certificado Global (NO recomendado para multi-tenant)

**Solo útil para:**
- Pruebas/desarrollo
- Un solo tenant (tu propia empresa)
- Casos legacy muy específicos

**Problemas del modelo global:**
1. ❌ **Riesgo legal** - Puede violar regulaciones DIAN
2. ❌ **Facturas incorrectas** - Todas saldrían a nombre de tu empresa, no del tenant
3. ❌ **Escalabilidad limitada** - Un solo certificado para todos
4. ❌ **Riesgo de seguridad** - Si se compromete, afecta a todos
5. ❌ **Sin flexibilidad** - Todos usan el mismo ambiente/configuración

### Para Onboarding Rápido

Si quieres facilitar onboarding pero mantener cumplimiento:

1. **Certificado global para pruebas:** Permite que tenants prueben en habilitación con certificado global
2. **Requerir certificado propio para producción:** Bloquea facturación en producción hasta que el tenant configure su propio certificado

**Implementación sugerida:**

```typescript
if (tenantId && !useTenant) {
  const config = await this.getDianConfigForTenant(tenantId);
  const isProduction = config?.env === DianEnvironment.PRODUCCION;
  
  if (isProduction) {
    // En producción, requerir certificado propio
    throw new BadRequestException(
      'Para facturar en producción, debe configurar su propio certificado DIAN.',
    );
  } else if (this.hasCertConfigured()) {
    // En habilitación, permitir fallback a certificado global
    this.logger.warn(
      `Tenant ${tenantId} usando certificado global para pruebas en habilitación`,
    );
    // Continuar con certificado global
  } else {
    throw new BadRequestException(
      'Configure certificado DIAN o use certificado global para pruebas.',
    );
  }
}
```

---

## 🔍 Verificar Configuración Actual

### Verificar Certificado Global

```bash
# Health check
curl https://TU-API/health

# Estado de configuración global (si existe endpoint)
curl https://TU-API/dian/config-status
```

### Verificar Certificado por Tenant

```bash
curl https://TU-API/dian/config-status \
  -H "Authorization: Bearer TOKEN_DEL_TENANT"
```

---

## 📚 Referencias

- [Guía Validación DIAN Multi-Tenant](./GUIA_VALIDACION_DIAN.md)
- [Diseño DIAN Multi-Tenant](./historico/DIAN_MULTITENANT_DISEÑO.md)
- Código: `apps/api/src/dian/dian.service.ts` (líneas 220-263, 2074-2090)

---

## ✅ Conclusión

**Tu modelo actual (certificado por tenant) es el diseño correcto para un SaaS multi-tenant.**

**No necesitas cambiar nada.** El sistema está bien diseñado:

- ✅ Cumple con regulaciones DIAN
- ✅ Escalable y seguro
- ✅ Preparado para producción
- ✅ Modelo de negocio claro

**El certificado global solo debería usarse para:**
- Desarrollo local
- Pruebas internas
- Casos muy específicos donde legalmente está permitido

**Para onboarding rápido de tenants:**
- Mejora la UI de configuración (paso a paso)
- Proporciona documentación clara (ya la tienes)
- Ofrece soporte durante el proceso
- Valida automáticamente certificados

---

**Última actualización:** Febrero 2026  
**Recomendación:** ✅ Mantener modelo actual (certificado por tenant)
