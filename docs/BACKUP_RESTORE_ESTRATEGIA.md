# 💾 Estrategia de Backup y Restore

**Fecha:** 2026-02-16  
**Propósito:** Documentación completa de la estrategia de backups, restauración y recuperación ante desastres

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Tipos de Backups](#tipos-de-backups)
3. [Estrategia de Backup](#estrategia-de-backup)
4. [Verificación de Integridad](#verificación-de-integridad)
5. [Procedimiento de Restauración](#procedimiento-de-restauración)
6. [Backup de Redis](#backup-de-redis)
7. [RTO y RPO](#rto-y-rpo)
8. [Pruebas de Restauración](#pruebas-de-restauración)

---

## 📊 Resumen Ejecutivo

### RTO (Recovery Time Objective)
**Objetivo:** Restaurar servicio en **menos de 4 horas** desde la detección del problema.

### RPO (Recovery Point Objective)
**Objetivo:** Máxima pérdida de datos aceptable: **24 horas** (backups diarios).

### Estrategia Actual
- ✅ Backups automáticos diarios (2:00 AM)
- ✅ Backups manuales bajo demanda
- ✅ Verificación de checksum SHA256
- ✅ Copia off-site a S3 (opcional)
- ✅ Retención configurable (default: 30 días)
- ✅ Backups por tenant (CSV/ZIP) y plataforma (pg_dump)

---

## 💾 Tipos de Backups

### 1. Backup de Plataforma (pg_dump)

**Formato:** SQL o formato custom de PostgreSQL  
**Contenido:** Base de datos completa (todos los tenants)  
**Uso:** Restauración completa del sistema

**Características:**
- Formato: `.sql` (texto) o `.dump`/`.backup` (binario)
- Incluye schema y datos
- Compatible con `pg_restore` o `psql`

### 2. Backup por Tenant (CSV/ZIP)

**Formato:** ZIP con archivos CSV  
**Contenido:** Datos del tenant específico  
**Uso:** Exportación de datos para un tenant específico

**Características:**
- Un CSV por tabla
- Solo datos (no incluye schema)
- Fácil de importar en Excel/Google Sheets
- Útil para migraciones o análisis externos

---

## 🔄 Estrategia de Backup

### Frecuencia

| Tipo | Frecuencia | Horario | Retención |
|------|------------|---------|------------|
| **Backup Automático** | Diario | 2:00 AM | 30 días |
| **Backup Manual** | Bajo demanda | - | Según necesidad |
| **Backup Pre-Migración** | Antes de migraciones | Manual | 90 días |

### Configuración

**Variables de entorno:**
```env
# Directorio de backups (default: ./backups)
BACKUP_DIR=./backups

# Retención en días (default: 30)
BACKUP_RETENTION_DAYS=30

# S3 para copia off-site (opcional)
AWS_ACCESS_KEY_ID=tu-key
AWS_SECRET_ACCESS_KEY=tu-secret
AWS_S3_BUCKET=tu-bucket
AWS_S3_REGION=us-east-1
```

### Proceso Automático

El sistema ejecuta backups automáticos mediante `@Cron`:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async scheduledBackup() {
  // Crea backup completo de plataforma
  await this.backupsService.createBackup();
  
  // Limpia backups antiguos
  await this.backupsService.cleanupOldBackups();
}
```

---

## ✅ Verificación de Integridad

### Checksum SHA256

Cada backup incluye un checksum SHA256 calculado automáticamente:

```typescript
const fileContent = await readFile(filepath);
const checksum = createHash('sha256').update(fileContent).digest('hex');
```

**Almacenamiento:**
- Guardado en tabla `BackupRun` en campo `checksum`
- Verificable antes de restaurar

### Verificación Manual

```bash
# Verificar checksum de un backup
sha256sum backups/backup-2026-02-16.sql

# Comparar con checksum almacenado en BD
psql -c "SELECT checksum FROM \"BackupRun\" WHERE id = 'backup-id';"
```

### Verificación Automática

El script de prueba (`scripts/test-restore.sh`) verifica automáticamente:
- ✅ Existencia del archivo
- ✅ Checksum SHA256
- ✅ Integridad del formato (SQL/ZIP válido)
- ✅ Restauración exitosa
- ✅ Integridad de datos básica

---

## 🔧 Procedimiento de Restauración

### Restaurar Backup SQL (Plataforma Completa)

#### Opción 1: Usando psql (backup .sql)

```bash
# 1. Detener aplicación
pm2 stop api

# 2. Crear backup de seguridad actual (por si acaso)
pg_dump -h localhost -U postgres -d comercial_electrica > backup-pre-restore.sql

# 3. Restaurar backup
psql -h localhost -U postgres -d comercial_electrica < backups/backup-2026-02-16.sql

# 4. Verificar restauración
psql -h localhost -U postgres -d comercial_electrica -c "SELECT COUNT(*) FROM \"Tenant\";"

# 5. Reiniciar aplicación
pm2 start api
```

#### Opción 2: Usando pg_restore (backup .dump/.backup)

```bash
# 1. Detener aplicación
pm2 stop api

# 2. Crear backup de seguridad
pg_dump -h localhost -U postgres -d comercial_electrica -F c -f backup-pre-restore.dump

# 3. Restaurar backup
pg_restore -h localhost -U postgres -d comercial_electrica backups/backup-2026-02-16.dump

# 4. Verificar y reiniciar
psql -h localhost -U postgres -d comercial_electrica -c "SELECT COUNT(*) FROM \"Tenant\";"
pm2 start api
```

### Restaurar Backup ZIP (Tenant Específico)

```bash
# 1. Extraer ZIP
unzip backups/backup-tenant-2026-02-16.zip -d /tmp/backup-extract

# 2. Importar CSVs manualmente según necesidad
# Ejemplo: Importar productos
psql -h localhost -U postgres -d comercial_electrica -c "\COPY \"Product\" FROM '/tmp/backup-extract/products.csv' CSV HEADER;"
```

**Nota:** La restauración de backups ZIP requiere importación manual tabla por tabla.

---

## 🔴 Backup de Redis

### Estrategia Actual

**Estado:** ⚠️ **No implementado automáticamente**

Redis almacena:
- Caché de datos (productos, clientes, reportes)
- Colas BullMQ (DIAN, backups, reportes)

### Impacto de Pérdida de Redis

- **Caché:** Se reconstruye automáticamente (impacto mínimo)
- **Colas:** Jobs pendientes se pierden (requieren reprocesamiento)

### Estrategia Recomendada

#### Opción 1: Snapshot Periódico

```bash
# Crear snapshot manual
redis-cli BGSAVE

# El snapshot se guarda en: /var/lib/redis/dump.rdb
# Copiar a ubicación segura
cp /var/lib/redis/dump.rdb backups/redis-dump-$(date +%Y%m%d).rdb
```

#### Opción 2: Script Automatizado

```bash
#!/bin/bash
# scripts/backup-redis.sh

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

# Crear snapshot
redis-cli -h $REDIS_HOST -p $REDIS_PORT BGSAVE

# Esperar a que termine
while [ "$(redis-cli -h $REDIS_HOST -p $REDIS_PORT LASTSAVE)" = "$(redis-cli -h $REDIS_HOST -p $REDIS_PORT LASTSAVE)" ]; do
  sleep 1
done

# Copiar snapshot
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis-dump-$(date +%Y%m%d-%H%M%S).rdb"

echo "Backup de Redis completado"
```

#### Opción 3: Persistencia AOF (Append-Only File)

Configurar Redis con AOF para mayor durabilidad:

```conf
# redis.conf
appendonly yes
appendfsync everysec
```

### Restaurar Backup de Redis

```bash
# 1. Detener Redis
systemctl stop redis

# 2. Restaurar snapshot
cp backups/redis-dump-2026-02-16.rdb /var/lib/redis/dump.rdb

# 3. Reiniciar Redis
systemctl start redis
```

---

## ⏱️ RTO y RPO

### RTO (Recovery Time Objective)

**Objetivo:** **4 horas**

**Desglose:**
- Detección del problema: 30 minutos
- Identificación del backup correcto: 15 minutos
- Restauración de base de datos: 1-2 horas
- Verificación y pruebas: 30 minutos
- Reinicio de servicios: 15 minutos
- **Total:** ~3-4 horas

**Factores que afectan RTO:**
- Tamaño de la base de datos
- Velocidad de red (si backup está en S3)
- Complejidad de la restauración
- Disponibilidad del personal técnico

### RPO (Recovery Point Objective)

**Objetivo:** **24 horas**

**Significa:** En el peor caso, se pueden perder hasta 24 horas de datos (desde el último backup).

**Mejoras posibles:**
- Backups cada 12 horas → RPO: 12 horas
- Backups cada 6 horas → RPO: 6 horas
- Backups continuos (WAL archiving) → RPO: minutos

---

## 🧪 Pruebas de Restauración

### Script de Prueba Automatizado

**Ubicación:** `scripts/test-restore.sh`

**Uso:**
```bash
# Configurar variables de entorno
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export BACKUP_DIR="./backups"
export TEST_DB_NAME="comercial_electrica_test_restore"

# Ejecutar prueba
chmod +x scripts/test-restore.sh
./scripts/test-restore.sh
```

**Qué verifica:**
- ✅ Existencia del archivo de backup
- ✅ Checksum SHA256
- ✅ Formato válido (SQL/ZIP)
- ✅ Restauración exitosa
- ✅ Integridad de datos básica

### Prueba Manual Recomendada

**Frecuencia:** Mensual o antes de migraciones importantes

**Pasos:**
1. Crear backup de prueba
2. Crear base de datos de prueba
3. Restaurar backup en base de datos de prueba
4. Verificar integridad de datos
5. Ejecutar tests básicos
6. Limpiar base de datos de prueba

**Comando rápido:**
```bash
# Crear backup de prueba
npm run backup

# Probar restauración
./scripts/test-restore.sh
```

---

## 📝 Checklist de Restauración

### Antes de Restaurar

- [ ] Identificar el backup correcto (fecha, tipo)
- [ ] Verificar checksum del backup
- [ ] Crear backup de seguridad del estado actual
- [ ] Notificar a usuarios sobre mantenimiento
- [ ] Detener aplicación y servicios relacionados

### Durante la Restauración

- [ ] Verificar conectividad a base de datos
- [ ] Restaurar backup paso a paso
- [ ] Verificar logs de restauración
- [ ] Verificar integridad de datos básica

### Después de Restaurar

- [ ] Verificar que aplicación inicia correctamente
- [ ] Ejecutar health checks
- [ ] Probar funcionalidades críticas
- [ ] Verificar métricas y logs
- [ ] Notificar a usuarios que servicio está restaurado

---

## 🔗 Referencias

- Runbook operacional: `docs/RUNBOOK_OPERACIONES.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Script de prueba: `scripts/test-restore.sh`
- Servicio de backups: `apps/api/src/backups/backups.service.ts`

---

**Última actualización:** 2026-02-16
