# Script para purgar la base de datos de test
# Elimina todos los datos de las tablas en el orden correcto para evitar FK violations

Write-Host "=== Purgando Base de Datos de Test ===" -ForegroundColor Cyan

# Verificar que estamos en el directorio correcto
$projectRoot = Split-Path -Parent $PSScriptRoot
$apiPath = Join-Path $projectRoot "apps\api"

if (-not (Test-Path $apiPath)) {
    Write-Host "[ERROR] No se encontró el directorio apps/api" -ForegroundColor Red
    exit 1
}

# Cambiar al directorio de la API
Push-Location $apiPath

try {
    Write-Host "`n1. Verificando conexión a la base de datos..." -ForegroundColor Yellow
    
    # Verificar que Prisma esté disponible
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] npx no está disponible. Asegúrate de tener Node.js instalado." -ForegroundColor Red
        exit 1
    }

    # Ejecutar script de Prisma para limpiar la base de datos
    Write-Host "`n2. Ejecutando limpieza de base de datos..." -ForegroundColor Yellow
    
    # Usar Prisma Studio o un script personalizado para limpiar
    # Por ahora, ejecutamos las migraciones de reset (esto elimina todos los datos)
    Write-Host "   Advertencia: Esto eliminará TODOS los datos de la base de datos de test" -ForegroundColor Yellow
    Write-Host "   Presiona Ctrl+C para cancelar, o Enter para continuar..." -ForegroundColor Yellow
    Read-Host

    # Ejecutar reset de Prisma (elimina todos los datos y vuelve a aplicar migraciones)
    Write-Host "`n3. Ejecutando prisma migrate reset..." -ForegroundColor Yellow
    npx prisma migrate reset --force --skip-seed
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n[OK] Base de datos purgada exitosamente" -ForegroundColor Green
    } else {
        Write-Host "`n[ERROR] Error al purgar la base de datos" -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "`n[ERROR] Error inesperado: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host "`n=== Proceso completado ===" -ForegroundColor Cyan
