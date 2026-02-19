# Guía de Diagnóstico con Logs

Esta guía explica cómo usar los logs agregados para diagnosticar errores en la aplicación.

## 📋 Logs Disponibles

### Frontend (Consola del Navegador)

Los logs aparecen en la **Consola de Desarrollador** del navegador (F12 → Console).

#### 1. **Billing Portal Session** (`createPortalSession`)

**Cuándo aparece:** Al hacer clic en "Gestionar método de pago y facturas"

**Logs que verás:**

```javascript
// Antes de la llamada
[Billing API] createPortalSession - Request: {
  url: '/billing/portal-session',
  payload: { returnUrl: 'https://...' },
  hasAuthToken: true,
  returnUrl: 'https://...'
}

// Si hay error
[Billing API] createPortalSession - Error: {
  message: '...',
  status: 400,
  data: { ... },
  error: { ... }
}
```

**Qué buscar:**
- ✅ `hasAuthToken: true` → El token está presente
- ❌ `hasAuthToken: false` → Problema de autenticación
- ❌ `status: 400` → Revisar `data` para ver el mensaje de error específico
- ❌ `status: 403` → Usuario sin permisos o sin tenant

#### 2. **DIAN Config Status** (`getDianConfigStatus`)

**Cuándo aparece:** Al cargar la página de facturación (si el plan incluye DIAN)

**Logs que verás:**

```javascript
// Antes de la llamada
[DIAN API] getDianConfigStatus - Request: {
  url: '/dian/config-status',
  hasAuthToken: true
}

// Si hay error
[DIAN API] getDianConfigStatus - Error: {
  message: '...',
  status: 403,
  data: { ... },
  error: { ... }
}
```

**Qué buscar:**
- ❌ `status: 403` → Usuario sin tenant o sin módulo `electronic_invoicing`
- ❌ `status: 401` → Token expirado o inválido

---

### Backend (Logs del Servidor)

Los logs aparecen en los **logs de Render** (Dashboard → Tu servicio → Logs).

#### 1. **Billing Portal Session**

**Logs que verás:**

```
[BillingPortalController] [createPortalSession] Request recibido - tenantId: abc-123, returnUrl: https://...
[BillingPortalController] [createPortalSession] returnUrl válido: https://...
[BillingPortalController] [createPortalSession] Llamando a billing.createPortalSession para tenant abc-123
[BillingPortalController] [createPortalSession] Sesión creada exitosamente para tenant abc-123
```

**Si hay error:**

```
[BillingPortalController] [createPortalSession] Usuario sin tenantId - userId: xyz-789
[BillingPortalController] [createPortalSession] Error al crear sesión para tenant abc-123: Error: ...
```

**Qué buscar:**
- ❌ `Usuario sin tenantId` → El usuario no tiene empresa asignada
- ❌ `Error al crear sesión` → Revisar el stack trace para ver el error específico de Stripe

#### 2. **DIAN Config Status**

**Logs que verás:**

```
[DianController] [getConfigStatus] Request recibido - userId: xyz-789, tenantId: abc-123
[DianController] [getConfigStatus] Obteniendo estado para tenant abc-123
[DianController] [getConfigStatus] Estado obtenido exitosamente para tenant abc-123
```

**Si hay error:**

```
[DianController] [getConfigStatus] Usuario sin tenantId - userId: xyz-789. Esto causará 403 si el usuario no es platform admin.
[DianController] [getConfigStatus] Error al obtener estado para tenant abc-123: Error: ...
```

**Qué buscar:**
- ❌ `Usuario sin tenantId` → El usuario no tiene empresa asignada (causa 403)
- ❌ `Error al obtener estado` → Revisar el stack trace para ver el error específico

---

## 🔍 Cómo Diagnosticar Errores Comunes

### Error 400 en `/billing/portal-session`

**Pasos:**

1. **Frontend (Consola del navegador):**
   - Abre la consola (F12)
   - Busca `[Billing API] createPortalSession - Error`
   - Revisa el campo `data` para ver el mensaje específico

2. **Backend (Logs de Render):**
   - Ve a Render Dashboard → Tu servicio → Logs
   - Busca `[createPortalSession]`
   - Revisa si aparece "Usuario sin tenantId" o el error específico

**Causas comunes:**
- Usuario sin `tenantId` (platform admin o usuario sin empresa)
- `returnUrl` inválido (aunque ahora se corrige automáticamente)
- Error de Stripe (revisar logs de `billing.createPortalSession`)

---

### Error 403 en `/dian/config-status`

**Pasos:**

1. **Frontend (Consola del navegador):**
   - Abre la consola (F12)
   - Busca `[DIAN API] getDianConfigStatus - Error`
   - Verifica `status: 403`

2. **Backend (Logs de Render):**
   - Ve a Render Dashboard → Tu servicio → Logs
   - Busca `[getConfigStatus]`
   - Revisa si aparece "Usuario sin tenantId"

**Causas comunes:**
- Usuario sin `tenantId` (platform admin o usuario sin empresa)
- Usuario sin módulo `electronic_invoicing` habilitado
- Usuario sin permiso `dian:manage`

**Solución:**
- El hook `useDianConfigStatus` ya está configurado para no ejecutarse si el usuario es platform admin
- Si el error persiste, verificar que el usuario tenga el módulo y permiso correctos

---

## 📝 Ejemplo de Diagnóstico Completo

### Escenario: Error 400 al abrir portal de Stripe

**1. Revisar Frontend (Consola):**
```
[Billing API] createPortalSession - Request: {
  url: '/billing/portal-session',
  payload: { returnUrl: 'https://mi-app.com/settings/billing' },
  hasAuthToken: true,
  returnUrl: 'https://mi-app.com/settings/billing'
}

[Billing API] createPortalSession - Error: {
  message: 'Bad Request',
  status: 400,
  data: { message: 'Solo los usuarios de una empresa pueden abrir el portal de facturación.' },
  error: { ... }
}
```

**2. Revisar Backend (Logs de Render):**
```
[BillingPortalController] [createPortalSession] Request recibido - tenantId: null, returnUrl: https://...
[BillingPortalController] [createPortalSession] Usuario sin tenantId - userId: user-123
```

**Diagnóstico:**
- El usuario no tiene `tenantId` asignado
- Es un platform admin o un usuario sin empresa

**Solución:**
- Si es platform admin: No debería intentar abrir el portal (el botón no debería aparecer)
- Si es usuario normal: Asignar una empresa al usuario desde el Panel Proveedor

---

## 🛠️ Cómo Acceder a los Logs

### Frontend (Navegador)

1. Abre la aplicación web
2. Presiona `F12` o clic derecho → "Inspeccionar"
3. Ve a la pestaña **Console**
4. Filtra por `[Billing API]` o `[DIAN API]`

### Backend (Render)

1. Ve a https://dashboard.render.com
2. Selecciona tu servicio API
3. Haz clic en **Logs** en el menú lateral
4. Busca los logs con `[BillingPortalController]` o `[DianController]`

---

## 💡 Tips

1. **Filtra los logs:** Usa `Ctrl+F` en la consola para buscar términos específicos
2. **Copia los logs:** Si necesitas ayuda, copia los logs completos (especialmente los errores)
3. **Revisa ambos lados:** Siempre revisa tanto frontend como backend para tener el panorama completo
4. **Timestamps:** Los logs del backend incluyen timestamps, úsalos para correlacionar eventos

---

## 🔄 Próximos Pasos

Si después de revisar los logs aún no encuentras la causa:

1. Copia los logs completos (frontend y backend)
2. Incluye el mensaje de error exacto
3. Incluye el `tenantId` y `userId` (sin exponer información sensible)
4. Revisa la configuración de Stripe en Render (variables de entorno)
