# 🔐 Backups en Producción: Guía Completa

## ⚠️ ¿Por qué `pg_dump` es CRÍTICO en producción?

### 1. **Tu sistema depende completamente de `pg_dump`**
   - El servicio `BackupsService` ejecuta `pg_dump` directamente (línea 67)
   - **Sin `pg_dump`, los backups NO funcionarán**
   - Los backups automáticos diarios (2 AM) fallarán silenciosamente

### 2. **Riesgos sin backups:**
   - ❌ **Pérdida total de datos** si hay corrupción de BD
   - ❌ **Sin recuperación** ante errores humanos (DELETE accidental, etc.)
   - ❌ **Sin cumplimiento** de políticas de seguridad/auditoría
   - ❌ **Sin rollback** ante migraciones fallidas

### 3. **Tu sistema ya tiene:**
   - ✅ Backups automáticos programados (`@Cron`)
   - ✅ Verificación de integridad (checksums SHA256)
   - ✅ Limpieza automática de backups antiguos
   - ✅ API REST para gestión manual de backups

**Pero TODO esto falla si `pg_dump` no está disponible.**

---

## 🚀 Configuración para Producción

### Opción 1: Instalar PostgreSQL Client Tools (Recomendado)

**En servidor Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install postgresql-client-15  # o la versión que uses
```

**En servidor Linux (CentOS/RHEL):**
```bash
sudo yum install postgresql15
```

**En Windows Server:**
```powershell
# Instalar PostgreSQL completo (incluye pg_dump)
choco install postgresql15 --params '/Password:TU_PASSWORD_AQUI'
```

**Verificar instalación:**
```bash
pg_dump --version
# Debe mostrar: pg_dump (PostgreSQL) 15.x
```

---

### Opción 2: Usar Docker con pg_dump incluido

Si tu aplicación corre en Docker, puedes usar un contenedor auxiliar:

```yaml
# docker-compose.prod.yml
services:
  api:
    # ... tu configuración actual
  
  pg_dump:
    image: postgres:15-alpine
    volumes:
      - ./backups:/backups
    entrypoint: ["/bin/sh"]
    command: ["-c", "pg_dump -h db_host -U user -d dbname -F c -f /backups/backup.sql"]
    environment:
      PGPASSWORD: ${DB_PASSWORD}
```

**Modificar `BackupsService` para usar Docker:**
```typescript
// En lugar de ejecutar pg_dump directamente
const command = `docker run --rm -v ${this.backupDir}:/backups postgres:15-alpine pg_dump -h ${dbHost} -U ${dbUser} -d ${dbName} -F c -f /backups/${filename}`;
```

---

### Opción 3: Usar servicios gestionados de PostgreSQL

**Si usas servicios cloud (AWS RDS, Azure Database, Google Cloud SQL):**
- Estos servicios tienen sus propios sistemas de backups
- **PERO** tu aplicación aún necesita `pg_dump` para:
  - Backups bajo demanda
  - Exportaciones para desarrollo/testing
  - Migraciones entre entornos

**Recomendación:** Usa AMBOS:
- Backups automáticos del proveedor (diarios, retención 30 días)
- Tu sistema de backups con `pg_dump` (para control granular)

---

## 📋 Checklist Pre-Producción

### ✅ Antes de desplegar:

1. **Verificar que `pg_dump` está instalado:**
   ```bash
   pg_dump --version
   ```

2. **Probar backup manual:**
   ```bash
   pg_dump -h localhost -p 5432 -U tu_usuario -d tu_base_datos -F c -f test_backup.sql
   ```

3. **Verificar variables de entorno:**
   ```env
   DATABASE_URL=postgresql://usuario:password@host:5432/database
   BACKUP_DIR=/var/backups/comercial-electrica
   AUTO_BACKUP_ENABLED=true
   MAX_BACKUPS_TO_KEEP=30
   ```

4. **Crear directorio de backups con permisos:**
   ```bash
   sudo mkdir -p /var/backups/comercial-electrica
   sudo chown tu_usuario:tu_grupo /var/backups/comercial-electrica
   sudo chmod 750 /var/backups/comercial-electrica
   ```

5. **Probar backup desde la API:**
   ```bash
   curl -X POST http://tu-api/backups \
     -H "Authorization: Bearer TU_TOKEN_ADMIN"
   ```

6. **Verificar que el cron job funciona:**
   - Revisar logs después de las 2 AM
   - Verificar que se crean backups automáticamente

---

## 🔒 Mejores Prácticas para Producción

### 1. **Almacenamiento de Backups**

**❌ NO guardes backups en el mismo servidor:**
- Si el servidor falla, pierdes todo

**✅ Usa almacenamiento externo:**
- **S3/Azure Blob/GCS:** Para backups en la nube
- **NFS/SMB:** Para servidor de archivos dedicado
- **Rsync:** Para copia a servidor remoto

**Ejemplo con S3:**
```typescript
// Modificar BackupsService para subir a S3 después de crear backup
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async createBackup() {
  // ... código actual de pg_dump ...
  
  // Subir a S3
  const s3Client = new S3Client({ region: 'us-east-1' });
  await s3Client.send(new PutObjectCommand({
    Bucket: 'tu-bucket-backups',
    Key: `backups/${filename}`,
    Body: fileContent,
  }));
  
  // Opcional: Eliminar backup local después de subir
}
```

### 2. **Encriptación**

**Backups deben estar encriptados:**
```bash
# Usar pg_dump con encriptación
pg_dump ... | gpg --encrypt --recipient tu-email@example.com > backup.sql.gpg
```

### 3. **Retención y Rotación**

Tu sistema ya tiene esto configurado (`MAX_BACKUPS_TO_KEEP`), pero considera:
- **Backups diarios:** Últimos 30 días
- **Backups semanales:** Últimos 12 semanas
- **Backups mensuales:** Últimos 12 meses

### 4. **Monitoreo y Alertas**

**Configurar alertas si backup falla:**
```typescript
// En BackupsService.scheduledBackup()
catch (error) {
  this.logger.error('Error en backup automático:', error);
  
  // Enviar alerta (email, Slack, PagerDuty, etc.)
  await this.alertService.sendCriticalAlert({
    type: 'BACKUP_FAILED',
    message: `Backup automático falló: ${error.message}`,
  });
}
```

### 5. **Pruebas de Restauración**

**Hacer pruebas periódicas:**
```bash
# Restaurar backup en base de datos de prueba
pg_restore -h localhost -U usuario -d db_prueba -c backup.sql

# Verificar integridad de datos
psql -h localhost -U usuario -d db_prueba -c "SELECT COUNT(*) FROM tabla_importante;"
```

---

## 🛠️ Alternativas si NO puedes usar `pg_dump`

### Opción A: Usar Prisma Migrate + Dump SQL

```typescript
// Crear dump usando Prisma directamente
async createBackup() {
  // Ejecutar migraciones para obtener schema
  await execAsync('npx prisma migrate deploy');
  
  // Exportar datos usando pg_dump o COPY
  // (más complejo, menos confiable)
}
```

**Limitación:** No es tan confiable como `pg_dump` para backups completos.

### Opción B: Usar servicios de backup del proveedor

- **AWS RDS:** Snapshots automáticos
- **Azure Database:** Backups automáticos
- **Google Cloud SQL:** Backups automáticos

**Limitación:** Menos control, dependes del proveedor.

### Opción C: Replicación en tiempo real

- **PostgreSQL Streaming Replication**
- **Logical Replication**

**Limitación:** No reemplaza backups, solo protege contra fallos de hardware.

---

## 📊 Resumen: ¿Qué hacer?

### ✅ **Para Producción: INSTALA `pg_dump`**

**Es la opción más simple y confiable:**
1. Instala PostgreSQL Client Tools en el servidor
2. Verifica que funciona: `pg_dump --version`
3. Configura variables de entorno
4. Prueba backup manual
5. Monitorea logs después del primer backup automático

### ⚠️ **Si NO puedes instalar `pg_dump`:**

1. **Usa Docker** con imagen de PostgreSQL
2. **O migra** a servicios gestionados con backups automáticos
3. **O implementa** alternativa usando Prisma (menos recomendado)

---

## 🔗 Recursos Adicionales

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [pg_dump Manual](https://www.postgresql.org/docs/current/app-pgdump.html)
- [AWS RDS Backup Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html)

---

**Fecha:** 2026-01-28  
**Estado:** Guía completa para producción
