#!/bin/bash

# Script de prueba de restauración de backups
# Verifica que los backups pueden restaurarse correctamente

set -e  # Salir si hay error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TEST_DB_NAME="${TEST_DB_NAME:-comercial_electrica_test_restore}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"

echo -e "${YELLOW}=== Script de Prueba de Restauración de Backups ===${NC}\n"

# Función para verificar checksum
verify_checksum() {
    local filepath=$1
    local expected_checksum=$2
    
    if [ ! -f "$filepath" ]; then
        echo -e "${RED}✗ Archivo no encontrado: $filepath${NC}"
        return 1
    fi
    
    local actual_checksum=$(sha256sum "$filepath" | cut -d' ' -f1)
    
    if [ "$actual_checksum" != "$expected_checksum" ]; then
        echo -e "${RED}✗ Checksum no coincide${NC}"
        echo -e "  Esperado: $expected_checksum"
        echo -e "  Actual:   $actual_checksum"
        return 1
    fi
    
    echo -e "${GREEN}✓ Checksum verificado${NC}"
    return 0
}

# Función para restaurar backup SQL
restore_sql_backup() {
    local backup_file=$1
    local db_name=$2
    
    echo -e "\n${YELLOW}Restaurando backup SQL: $backup_file${NC}"
    
    # Extraer credenciales de DATABASE_URL
    local db_url=$DATABASE_URL
    local db_host=$(echo $db_url | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo $db_url | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    local db_user=$(echo $db_url | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    local db_password=$(echo $db_url | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Crear base de datos de prueba si no existe
    echo "Creando base de datos de prueba: $db_name"
    PGPASSWORD=$db_password psql -h $db_host -p $db_port -U $db_user -d postgres -c "DROP DATABASE IF EXISTS $db_name;" 2>/dev/null || true
    PGPASSWORD=$db_password psql -h $db_host -p $db_port -U $db_user -d postgres -c "CREATE DATABASE $db_name;" || {
        echo -e "${RED}✗ Error al crear base de datos${NC}"
        return 1
    }
    
    # Restaurar backup
    echo "Restaurando backup..."
    if [[ "$backup_file" == *.sql ]]; then
        # Backup SQL plano
        PGPASSWORD=$db_password psql -h $db_host -p $db_port -U $db_user -d $db_name < "$backup_file" || {
            echo -e "${RED}✗ Error al restaurar backup SQL${NC}"
            return 1
        }
    elif [[ "$backup_file" == *.dump ]] || [[ "$backup_file" == *.backup ]]; then
        # Backup formato custom de pg_dump
        PGPASSWORD=$db_password pg_restore -h $db_host -p $db_port -U $db_user -d $db_name "$backup_file" || {
            echo -e "${RED}✗ Error al restaurar backup pg_dump${NC}"
            return 1
        }
    else
        echo -e "${RED}✗ Formato de backup no reconocido${NC}"
        return 1
    fi
    
    # Verificar que se restauraron datos
    local table_count=$(PGPASSWORD=$db_password psql -h $db_host -p $db_port -U $db_user -d $db_name -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [ "$table_count" -eq "0" ]; then
        echo -e "${RED}✗ No se restauraron tablas${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Backup restaurado exitosamente ($table_count tablas)${NC}"
    
    # Verificar integridad básica
    echo "Verificando integridad de datos..."
    local tenant_count=$(PGPASSWORD=$db_password psql -h $db_host -p $db_port -U $db_user -d $db_name -t -c "SELECT COUNT(*) FROM \"Tenant\";" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$tenant_count" -gt "0" ]; then
        echo -e "${GREEN}✓ Integridad verificada ($tenant_count tenants encontrados)${NC}"
    else
        echo -e "${YELLOW}⚠ No se encontraron tenants (puede ser normal si es backup vacío)${NC}"
    fi
    
    return 0
}

# Función para verificar backup ZIP (tenant)
verify_zip_backup() {
    local backup_file=$1
    
    echo -e "\n${YELLOW}Verificando backup ZIP: $backup_file${NC}"
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}✗ Archivo no encontrado${NC}"
        return 1
    fi
    
    # Verificar que es un ZIP válido
    if ! unzip -t "$backup_file" > /dev/null 2>&1; then
        echo -e "${RED}✗ Archivo ZIP corrupto${NC}"
        return 1
    fi
    
    # Listar archivos dentro del ZIP
    echo "Archivos en el backup:"
    unzip -l "$backup_file" | tail -n +4 | head -n -2
    
    echo -e "${GREEN}✓ Backup ZIP válido${NC}"
    return 0
}

# Función principal
main() {
    # Verificar que existe el directorio de backups
    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${RED}✗ Directorio de backups no encontrado: $BACKUP_DIR${NC}"
        exit 1
    fi
    
    echo "Directorio de backups: $BACKUP_DIR"
    echo "Base de datos de prueba: $TEST_DB_NAME"
    echo ""
    
    # Buscar backups recientes
    local sql_backups=$(find "$BACKUP_DIR" -name "backup-*.sql" -o -name "backup-*.dump" -o -name "backup-*.backup" | head -1)
    local zip_backups=$(find "$BACKUP_DIR" -name "backup-tenant-*.zip" | head -1)
    
    if [ -z "$sql_backups" ] && [ -z "$zip_backups" ]; then
        echo -e "${YELLOW}⚠ No se encontraron backups para probar${NC}"
        echo "Ejecuta primero: npm run backup (o crea un backup manualmente)"
        exit 0
    fi
    
    # Probar backup SQL si existe
    if [ -n "$sql_backups" ]; then
        echo -e "${YELLOW}Probando backup SQL: $sql_backups${NC}"
        
        # Verificar checksum si hay metadata disponible
        # (En producción, esto vendría de la base de datos)
        
        if restore_sql_backup "$sql_backups" "$TEST_DB_NAME"; then
            echo -e "\n${GREEN}✓ Prueba de restauración SQL exitosa${NC}"
            
            # Limpiar base de datos de prueba
            echo "Limpiando base de datos de prueba..."
            local db_url=$DATABASE_URL
            local db_host=$(echo $db_url | sed -n 's/.*@\([^:]*\):.*/\1/p')
            local db_port=$(echo $db_url | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
            local db_user=$(echo $db_url | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
            local db_password=$(echo $db_url | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
            PGPASSWORD=$db_password psql -h $db_host -p $db_port -U $db_user -d postgres -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" 2>/dev/null || true
        else
            echo -e "\n${RED}✗ Prueba de restauración SQL falló${NC}"
            exit 1
        fi
    fi
    
    # Probar backup ZIP si existe
    if [ -n "$zip_backups" ]; then
        echo -e "\n${YELLOW}Probando backup ZIP: $zip_backups${NC}"
        
        if verify_zip_backup "$zip_backups"; then
            echo -e "\n${GREEN}✓ Prueba de backup ZIP exitosa${NC}"
        else
            echo -e "\n${RED}✗ Prueba de backup ZIP falló${NC}"
            exit 1
        fi
    fi
    
    echo -e "\n${GREEN}=== Todas las pruebas pasaron exitosamente ===${NC}"
}

# Ejecutar función principal
main
