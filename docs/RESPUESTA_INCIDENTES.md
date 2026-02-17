# Guía de respuesta a incidentes de seguridad

**Objetivo:** Actuar de forma ordenada ante un incidente de seguridad (fuga de datos, compromiso de credenciales, fallos críticos).

---

## 1. Contactos y recursos

| Rol / Recurso | Uso |
|---------------|-----|
| **Logs de aplicación** | Donde se despliega la API (Render, VPS, etc.). Revisar errores 5xx, intentos de login fallidos, accesos a rutas sensibles. |
| **Base de datos** | Backup y acceso de solo lectura para análisis. No modificar datos sin evidencia. |
| **Stripe Dashboard** | Eventos de webhook, pagos fallidos, disputas. |
| **Soporte hosting** | Proveedor donde está la API/BD (Render, Railway, etc.). |
| **Dominio / DNS** | Donde gestionas orion-app.cloud (para revocar o cambiar si hay compromiso). |

---

## 2. Tipos de incidente y acciones

### 2.1 Posible fuga de datos entre tenants

**Señales:** Un cliente reporta ver datos de otra empresa, o en logs aparecen consultas con `tenantId` que no coincide con el usuario.

**Acciones:**
1. **Contener:** No borrar nada. Activar logs detallados (si están disponibles) para capturar el siguiente intento.
2. **Investigar:** Revisar en código y en logs qué endpoint y qué query pudo devolver datos cruzados. Buscar en el repo: `findMany`, `findFirst` sin `tenantId` en el `where`.
3. **Corregir:** Añadir filtro por `tenantId` y desplegar fix. Revisar auditoría (`AuditLog`) por si hubo accesos anómalos.
4. **Comunicar:** Según política (aviso a afectados, registro interno). Documentar en un post-mortem breve.

---

### 2.2 JWT comprometido o robo de sesión

**Señales:** Usuario reporta actividad que no reconoce, o detectas el mismo token usado desde muchas IPs.

**Acciones:**
1. **Contener:** El usuario debe cambiar contraseña de inmediato (flujo “Olvidé mi contraseña”). Si tienes “cerrar todas las sesiones”, ejecutarlo para ese usuario.
2. **Investigar:** Revisar `AuditLog` con `category: 'security'` y `action: 'login'` / `login_failed` para ese usuario. Revisar IPs y horarios.
3. **Mitigar:** Valorar acortar la expiración del JWT en producción (`JWT_ACCESS_EXPIRATION` o equivalente). Asegurar que los tokens no incluyan datos sensibles (ya no incluyen email).
4. **Comunicar:** Indicar al usuario que cambie la contraseña y revise accesos recientes.

---

### 2.3 Webhooks de Stripe fallidos o sospechosos

**Señales:** Muchos reintentos en la cola, o eventos `invoice.payment_failed` / suscripciones canceladas inesperadas.

**Acciones:**
1. **Verificar configuración:** En producción debe estar `STRIPE_WEBHOOK_SECRET`. Si falta, los webhooks se rechazan (ya validado en código).
2. **Revisar cola:** Revisar jobs fallidos en BullMQ (stripe-webhooks). Logs del worker para ver el error concreto.
3. **Idempotencia:** Los eventos ya procesados están en `StripeEvent`; no reprocesar a mano sin comprobar.
4. **Stripe Dashboard:** Comprobar estado de suscripciones y que la URL del webhook sea la correcta y con HTTPS.

---

### 2.4 Credenciales expuestas (env, código, logs)

**Señales:** Alguna variable de entorno o secreto aparece en un log, en un repo público o en un mensaje.

**Acciones:**
1. **Rotar de inmediato:** Cambiar la credencial afectada (BD, JWT secret, Stripe, etc.) en el entorno correspondiente.
2. **Revisar alcance:** Comprobar si el secreto se usó desde alguna IP o servicio no autorizado (logs de acceso, Stripe, BD).
3. **Eliminar rastros:** Quitar el secreto de logs, historial de Git (si se subió por error) siguiendo buenas prácticas (por ejemplo [GitHub – removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)).
4. **Prevenir:** Revisar que no queden fallbacks con credenciales en código (ya eliminado en Prisma) y que la validación de config (`ConfigValidationModule`) exija las variables necesarias.

---

### 2.5 Errores 5xx o caída del servicio

**Señales:** Aumento de 500/502/503, alertas de disponibilidad o tiempo de respuesta.

**Acciones:**
1. **Estabilidad:** Reinicio controlado del servicio si es necesario. Revisar uso de CPU/memoria y conexiones a BD (pool).
2. **Logs:** Buscar el mensaje y, en desarrollo, el stack trace (en producción los stack traces están sanitizados).
3. **Base de datos:** Comprobar migraciones aplicadas, que no falten columnas (P2021/P2022). Ver `TROUBLESHOOTING.md` para errores Prisma.
4. **Post-incidente:** Documentar causa y cambio aplicado (config, código, escalado).

---

## 3. Checklist rápido post-incidente

- [ ] Contención aplicada (rotar credenciales, corregir código, etc.).
- [ ] Causa raíz identificada y documentada.
- [ ] Fix desplegado y verificado.
- [ ] Logs y auditoría revisados para alcance.
- [ ] Comunicación interna y/o a afectados según política.
- [ ] Entrada breve en post-mortem o en `docs/` (qué pasó, qué se hizo, qué se evita a partir de ahora).

---

## 4. Referencias

- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) – Errores frecuentes y soluciones.
- [RUNBOOK_OPERACIONES.md](./RUNBOOK_OPERACIONES.md) – Operación y despliegue.
- [AUDITORIA_SEGURIDAD_MULTITENANT.md](./AUDITORIA_SEGURIDAD_MULTITENANT.md) – Medidas de seguridad implementadas.
- [CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md](./CORRECCIONES_SEGURIDAD_IMPLEMENTADAS.md) – Detalle de las correcciones.
