# Solución de Problemas: Error de Facturación

## Error: "No se pudo conectar con el servicio de facturación"

Este error aparece cuando la aplicación intenta conectarse con Stripe para gestionar suscripciones y métodos de pago, pero falla la conexión.

### Causas Posibles

#### 1. **STRIPE_SECRET_KEY no configurado en producción** (Más común)

**Síntoma:** El error aparece al intentar abrir el portal de Stripe o gestionar la suscripción.

**Causa:** La variable de entorno `STRIPE_SECRET_KEY` no está configurada en el servidor de producción (Render, Vercel, etc.).

**Solución:**
1. Ve a tu cuenta de Stripe: https://dashboard.stripe.com
2. Obtén tu **Secret Key**:
   - **Pruebas:** En *Developers → API keys* copia la clave que empieza con `sk_test_...`
   - **Producción:** Usa la clave que empieza con `sk_live_...` (solo si ya activaste tu cuenta)
3. Configura la variable en tu plataforma de despliegue:
   - **Render:** Dashboard → Tu servicio → Environment → Add Environment Variable
     - Key: `STRIPE_SECRET_KEY`
     - Value: `sk_test_...` (o `sk_live_...` en producción)
   - **Vercel:** Settings → Environment Variables → Add
   - **Otros:** Según la documentación de tu plataforma

**Verificación:**
- Reinicia el servicio después de agregar la variable
- Revisa los logs del servidor para confirmar que no aparece el warning: "STRIPE_SECRET_KEY no configurado"

---

#### 2. **API Key inválida o expirada**

**Síntoma:** El error aparece incluso después de configurar `STRIPE_SECRET_KEY`.

**Causa:** La clave de Stripe es incorrecta, fue revocada, o estás usando una clave de prueba en producción (o viceversa).

**Solución:**
1. Verifica que estés usando la clave correcta según el entorno:
   - **Desarrollo/Pruebas:** `sk_test_...`
   - **Producción:** `sk_live_...` (solo si tu cuenta está activada)
2. Genera una nueva clave en Stripe Dashboard si es necesario
3. Actualiza la variable de entorno con la nueva clave
4. Reinicia el servicio

**Verificación:**
- Los logs del servidor mostrarán errores específicos si la API key es inválida
- Busca mensajes como "Invalid API Key" o "api_key" en los logs

---

#### 3. **Problemas de red/conectividad**

**Síntoma:** El error aparece intermitentemente o solo en ciertos momentos.

**Causa:** El servidor no puede conectarse con los servidores de Stripe (bloqueo de firewall, problemas de DNS, etc.).

**Solución:**
1. Verifica que el servidor tenga acceso a internet
2. Revisa si hay restricciones de firewall que bloqueen conexiones salientes a `api.stripe.com`
3. Verifica la conectividad desde el servidor:
   ```bash
   curl https://api.stripe.com/v1/charges
   ```
4. Si estás en un entorno corporativo, asegúrate de que Stripe no esté bloqueado

**Verificación:**
- Revisa los logs del servidor para ver si hay errores de timeout o conexión rechazada

---

#### 4. **Cliente no existe en Stripe**

**Síntoma:** El error aparece cuando intentas abrir el portal de Stripe para un tenant específico.

**Causa:** El tenant no tiene un cliente creado en Stripe, o el cliente fue eliminado.

**Solución:**
1. Verifica en Stripe Dashboard → Customers si existe un cliente con `metadata['tenantId']` igual al ID del tenant
2. Si no existe, el cliente se creará automáticamente cuando:
   - Se asigne un plan al tenant desde el Panel Proveedor
   - Se cree una suscripción por primera vez
3. Si el cliente fue eliminado, contacta a soporte para reactivar la suscripción

**Verificación:**
- Revisa los logs del servidor para ver si aparece: "No se encontró información de facturación"

---

#### 5. **STRIPE_WEBHOOK_SECRET no configurado (solo afecta webhooks)**

**Síntoma:** Los webhooks de Stripe no se procesan, pero el portal puede funcionar.

**Causa:** La variable `STRIPE_WEBHOOK_SECRET` no está configurada.

**Solución:**
1. En Stripe Dashboard → Developers → Webhooks
2. Crea o edita el webhook apuntando a: `https://tu-api.com/billing/webhooks/stripe`
3. Selecciona los eventos: `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`
4. Copia el **Signing secret** (empieza con `whsec_...`)
5. Configura la variable `STRIPE_WEBHOOK_SECRET` en tu plataforma de despliegue

**Nota:** Esta variable es opcional para desarrollo, pero **requerida en producción** si `STRIPE_SECRET_KEY` está configurado.

---

### Cómo Diagnosticar el Problema

1. **Revisa los logs del servidor:**
   - Busca mensajes que contengan "Stripe", "billing", o "facturación"
   - Los logs ahora incluyen detalles del error específico (gracias a las mejoras recientes)

2. **Verifica las variables de entorno:**
   ```bash
   # En Render: Dashboard → Environment
   # Verifica que STRIPE_SECRET_KEY esté configurada y no esté vacía
   ```

3. **Prueba la conexión manualmente:**
   - Si tienes acceso SSH al servidor, puedes probar con curl o desde la consola de Node.js

4. **Revisa el estado de Stripe:**
   - Ve a https://status.stripe.com para ver si hay problemas conocidos

---

### Pasos de Solución Rápida

1. ✅ Verifica que `STRIPE_SECRET_KEY` esté configurada en producción
2. ✅ Verifica que la clave sea válida (no expirada, formato correcto)
3. ✅ Reinicia el servicio después de cambiar variables de entorno
4. ✅ Revisa los logs del servidor para el error específico
5. ✅ Si el problema persiste, verifica la conectividad de red

---

### Mensajes de Error Específicos

| Mensaje | Causa Probable | Solución |
|---------|---------------|----------|
| "La gestión de facturación no está configurada" | `STRIPE_SECRET_KEY` no está configurada | Configurar la variable de entorno |
| "No se pudo conectar con el servicio de facturación" | Error de conexión con Stripe | Verificar API key, red, o configuración |
| "Error de configuración del servicio de facturación" | API key inválida | Verificar y actualizar la clave |
| "No se encontró información de facturación" | Cliente no existe en Stripe | Crear suscripción desde Panel Proveedor |
| "No hay suscripción con Stripe para esta cuenta" | Tenant no tiene suscripción | Asignar plan desde Panel Proveedor |

---

### Contacto

Si el problema persiste después de seguir estos pasos, contacta a soporte con:
- El mensaje de error exacto
- Los logs del servidor (últimas 50 líneas relacionadas con billing)
- El ID del tenant afectado (si aplica)
- La fecha y hora aproximada del error
