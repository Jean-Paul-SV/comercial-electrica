# Rotación de clave de cifrado DIAN

**C3.3:** Procedimiento para rotar `DIAN_CERT_ENCRYPTION_KEY` sin perder acceso a certificados existentes.

---

## ¿Cuándo rotar?

- **Seguridad:** Cada 6-12 meses como buena práctica
- **Fuga de clave:** Si sospechas que la clave fue comprometida
- **Cambio de infraestructura:** Al migrar a nuevo gestor de secretos

---

## Procedimiento paso a paso

### 1. Preparación

1. **Generar nueva clave:**
   ```bash
   # Opción 1: Hex (64 caracteres)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Opción 2: Base64 (44 caracteres)
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Backup de BD:** Hacer backup completo antes de rotar
   ```bash
   # Ejemplo con pg_dump
   pg_dump $DATABASE_URL > backup-pre-rotation-$(date +%Y%m%d).sql
   ```

3. **Verificar certificados actuales:**
   ```bash
   cd apps/api
   OLD_DIAN_CERT_KEY="clave-actual" npm run rotate-dian-key -- --old-key="clave-actual" --new-key="clave-actual" --dry-run
   ```
   Esto verifica que todos los certificados se pueden descifrar con la clave actual.

### 2. Rotación (dry-run primero)

1. **Ejecutar dry-run:**
   ```bash
   cd apps/api
   OLD_DIAN_CERT_KEY="clave-vieja" NEW_DIAN_CERT_KEY="clave-nueva" npm run rotate-dian-key -- --dry-run
   ```

2. **Revisar resultados:**
   - Verificar que todos los certificados se pueden rotar
   - Si hay errores, corregirlos antes de continuar

3. **Ejecutar rotación real:**
   ```bash
   cd apps/api
   OLD_DIAN_CERT_KEY="clave-vieja" NEW_DIAN_CERT_KEY="clave-nueva" npm run rotate-dian-key
   ```

### 3. Actualizar variables de entorno

1. **En Render (o tu proveedor):**
   - Añadir temporalmente `DIAN_CERT_ENCRYPTION_KEY_OLD` con la clave vieja
   - Actualizar `DIAN_CERT_ENCRYPTION_KEY` con la clave nueva
   - Guardar y redeploy

2. **Verificar que funciona:**
   - Probar descargar/verificar un certificado desde la UI
   - Verificar logs: no deberían aparecer warnings de descifrado con clave antigua

### 4. Limpieza (después de 1-2 semanas)

1. **Verificar que no hay certificados usando clave antigua:**
   ```bash
   # Revisar logs durante 1-2 semanas
   # Si no hay warnings, es seguro eliminar la clave antigua
   ```

2. **Eliminar `DIAN_CERT_ENCRYPTION_KEY_OLD`** de variables de entorno

---

## Soporte para múltiples claves durante transición

El sistema soporta tener ambas claves configuradas durante la transición:

- `DIAN_CERT_ENCRYPTION_KEY`: Clave nueva (principal)
- `DIAN_CERT_ENCRYPTION_KEY_OLD`: Clave antigua (fallback)

Durante la transición, el sistema intentará descifrar primero con la clave nueva, y si falla, intentará con la antigua. Esto permite:

- Rotar gradualmente sin downtime
- Mantener acceso a certificados durante la transición
- Detectar certificados que aún usan la clave antigua

---

## Troubleshooting

### Error: "No se pudo descifrar con ninguna clave"

**Causa:** El certificado está cifrado con una clave diferente a las proporcionadas.

**Solución:**
1. Verificar que `OLD_DIAN_CERT_KEY` es la clave actualmente en `DIAN_CERT_ENCRYPTION_KEY`
2. Si el certificado fue cifrado con otra clave, necesitarás esa clave para rotarlo
3. Considerar pedir al tenant que re-suban el certificado

### Error: "Payload cifrado inválido"

**Causa:** El certificado en BD está corrupto o en formato incorrecto.

**Solución:**
1. Verificar integridad de BD
2. Pedir al tenant que re-suban el certificado

### Algunos certificados fallan durante rotación

**Causa:** Puede haber certificados cifrados con diferentes claves (migración parcial previa).

**Solución:**
1. Ejecutar rotación en batches por tenant
2. Para certificados que fallan, pedir al tenant que re-suban el certificado
3. Documentar qué tenants necesitan re-subir certificados

---

## Seguridad

- **Nunca** commits la clave en el repositorio
- **Nunca** loguees las claves en producción
- Usa un gestor de secretos (AWS Secrets Manager, HashiCorp Vault, etc.) en producción
- Rota las claves periódicamente (cada 6-12 meses)
- Mantén backups antes de rotar

---

## Automatización (futuro)

Para producción avanzada, considera:

1. **Rotación automática:** Job que rota claves cada X meses
2. **Alertas:** Notificar cuando certificados usan clave antigua por >30 días
3. **Métricas:** Dashboard de certificados por versión de clave
