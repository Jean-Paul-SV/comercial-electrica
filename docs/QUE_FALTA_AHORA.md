# Qué hace falta ahora (resumen actual)

**Contexto:** Tras configurar variables de entorno (Stripe, PayU, FRONTEND_URL), este documento resume **lo que falta por tu parte** para tener el sistema listo según lo que hemos hecho y la documentación del proyecto.

---

## 1. Variables de entorno que debes rellenar

En el `.env` (raíz del proyecto) ya están definidas las variables; **falta que pongas los valores reales** cuando los tengas:

| Variable | Dónde obtenerla | Prioridad |
|----------|-----------------|-----------|
| **STRIPE_SECRET_KEY** | [dashboard.stripe.com](https://dashboard.stripe.com) (cuenta US) → Developers → API keys | Si usas suscripciones |
| **STRIPE_WEBHOOK_SECRET** | Stripe → Developers → Webhooks → Signing secret | Si usas Stripe en producción |
| **PAYU_API_KEY** | [colombia.payu.com](https://colombia.payu.com) → Configuración técnica | Pagos en Colombia |
| **PAYU_MERCHANT_ID** | PayU → ID del comercio (merchantId) | Pagos en Colombia |
| **PAYU_ACCOUNT_ID** | PayU → ID de cuenta (ej. 512321 para pruebas) | Pagos en Colombia |
| **PAYU_CONFIRMATION_URL** | URL de tu API para confirmación (ej. https://tu-dominio.com/payu/webhook) | Producción con PayU |

- Sin estas claves, la API sigue funcionando; solo no creará transacciones reales en Stripe/PayU.
- **PayU:** Cuenta en colombia.payu.com; acepta PSE, Nequi, Daviplata y tarjetas. Ver [CONFIGURAR_PAGOS_WOMPI_STRIPE.md](./CONFIGURAR_PAGOS_WOMPI_STRIPE.md).

---

## 2. Pruebas y arranque (inmediato)

- [ ] Arrancar API con `npm run dev` (o `start`) y comprobar que no falla la validación de config (con tu `.env` actual).
- [ ] Ejecutar pruebas manuales de seguridad según [PRUEBAS_MANUALES_SEGURIDAD.md](./PRUEBAS_MANUALES_SEGURIDAD.md) (opcional pero recomendado antes de producción).
- [ ] Ejecutar el script de verificación de seguridad (ver más abajo): `node scripts/verificar-seguridad-api.js` con la API en marcha.

---

## 3. Producción (antes de lanzar)

- [ ] Definir en el entorno de producción: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `ALLOWED_ORIGINS`.
- [ ] Si usas Stripe: `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`.
- [ ] Si usas PayU: `PAYU_*` y en producción `PAYU_CONFIRMATION_URL` (URL de confirmación).
- [ ] Nunca commitear `.env`; en producción usar gestor de secretos (Render Secrets, AWS, etc.).

---

## 4. DIAN (solo si facturas electrónicamente en Colombia)

- [ ] Obtener credenciales reales: certificado `.p12`, Software ID, PIN, NIT emisor (con tu contador/DIAN).
- [ ] Configurar en habilitación las variables `DIAN_*` (incl. certificado) y emitir al menos una factura de prueba.
- [ ] Validar respuesta DIAN, CUFE y PDF con QR.
- [ ] Pasar a producción DIAN cuando corresponda.

---

## 5. Negocio y operación (según tu plan)

- [ ] Definir canal de soporte (WhatsApp/email/teléfono) y configurar en la app (`NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER` si aplica).
- [ ] Definir planes y precios; configurarlos en Stripe y en el panel proveedor.
- [ ] (Opcional) Contrato/licencia de uso, dominio propio, onboarding para clientes.
- [ ] Backups automáticos y prueba de restauración; alertas y monitoreo (ver RUNBOOK_OPERACIONES.md).

---

## 6. Script de verificación de seguridad

El proyecto incluye un script que automatiza parte de las pruebas de seguridad (JWT sin email, errores sin UUIDs):

- **Ubicación:** `scripts/verificar-seguridad-api.js`
- **Requisitos:** API corriendo (`npm run dev` o `npm run start` en la API) y un usuario creado (por ejemplo tras `npm run prisma:seed -w api`).
- **Uso desde la raíz del proyecto:**
  ```bash
  node scripts/verificar-seguridad-api.js
  ```
  Por defecto usa `API_URL=http://localhost:3000`, `API_EMAIL=admin@negocio.local`, `API_PASSWORD=AdminNegocio1!` (usuario del seed).
- **Con otro usuario o API:**
  ```bash
  API_URL=http://localhost:3000 API_EMAIL=admin@negocio.local API_PASSWORD=AdminNegocio1! node scripts/verificar-seguridad-api.js
  ```
- Si el script termina con código 0, las comprobaciones pasaron. Si falla el login, revisa que el seed se haya ejecutado y que el usuario/contraseña coincidan.

---

## 7. Opcional (no bloquea uso ni venta)

- **Compras (pedidos de compra):** El módulo en `/purchases` queda deshabilitado; no está previsto implementar listado ni “Recibir pedido”.
- Botón **“Reintentar envíos DIAN pendientes”**: ya implementado en la página de Facturas (reencola documentos en estado DRAFT o REJECTED).
- Auditoría externa de seguridad antes de lanzamiento público.
- Checklist de seguridad en cada PR (`.github/SECURITY_CHECKLIST.md`).

---

## Resumen en una tabla

| Área | Estado | Acción |
|------|--------|--------|
| Variables Stripe/PayU en `.env` | Definidas, vacías | Rellenar cuando tengas las cuentas/keys |
| Documentación Stripe (US) / PayU | Hecho | — |
| Arranque y pruebas manuales | Pendiente | Probar API; script `scripts/verificar-seguridad-api.js` documentado |
| Variables en producción | Pendiente | Configurar en el host (Render, etc.) |
| DIAN real | Pendiente | Credenciales + validar en habilitación |
| Negocio (soporte, planes, contrato) | Según plan | Definir y configurar cuando vayas a vender |

Referencias: [CONFIGURAR_PAGOS_WOMPI_STRIPE.md](./CONFIGURAR_PAGOS_WOMPI_STRIPE.md), [CHECKLIST_SEGURIDAD_Y_SIGUIENTES_PASOS.md](./CHECKLIST_SEGURIDAD_Y_SIGUIENTES_PASOS.md), [README.md](../README.md) (checklist “Qué tengo que hacer yo”).
