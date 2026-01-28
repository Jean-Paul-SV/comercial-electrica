# Script de verificacion y solucion para conflicto de PostgreSQL
# Ejecutar desde la raiz del proyecto

Write-Host "=== Verificacion de PostgreSQL ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar si Docker esta corriendo
Write-Host "1. Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerPs = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [ERROR] Docker no esta corriendo o no esta disponible" -ForegroundColor Red
        Write-Host "   Solucion: Inicia Docker Desktop" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "   [OK] Docker esta corriendo" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] No se pudo verificar Docker" -ForegroundColor Red
    exit 1
}

# 2. Verificar contenedores Docker
Write-Host ""
Write-Host "2. Verificando contenedores Docker..." -ForegroundColor Yellow
$containers = docker ps --format "{{.Names}}" 2>&1
if ($containers -match "ce_postgres") {
    Write-Host "   [OK] Contenedor ce_postgres esta corriendo" -ForegroundColor Green
} else {
    Write-Host "   [ERROR] Contenedor ce_postgres NO esta corriendo" -ForegroundColor Red
    Write-Host "   Solucion: Ejecuta 'npm run db:up' desde la raiz del proyecto" -ForegroundColor Yellow
}

if ($containers -match "ce_redis") {
    Write-Host "   [OK] Contenedor ce_redis esta corriendo" -ForegroundColor Green
} else {
    Write-Host "   [ERROR] Contenedor ce_redis NO esta corriendo" -ForegroundColor Red
}

# 3. Verificar servicios de Windows PostgreSQL
Write-Host ""
Write-Host "3. Verificando servicios de PostgreSQL en Windows..." -ForegroundColor Yellow
try {
    $postgresServices = Get-Service | Where-Object { $_.Name -like "*postgres*" -or $_.DisplayName -like "*PostgreSQL*" }
    if ($postgresServices) {
        foreach ($service in $postgresServices) {
            $status = if ($service.Status -eq "Running") { "CORRIENDO" } else { "DETENIDO" }
            $color = if ($service.Status -eq "Running") { "Red" } else { "Green" }
            Write-Host "   [ADVERTENCIA] Servicio encontrado: $($service.DisplayName) - Estado: $status" -ForegroundColor $color
            
            if ($service.Status -eq "Running") {
                Write-Host "      [ADVERTENCIA] Este servicio puede estar usando el puerto 5432" -ForegroundColor Yellow
                Write-Host "      Solucion: Deten este servicio y cambialo a 'Manual' para evitar conflictos" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   [OK] No se encontraron servicios de PostgreSQL de Windows" -ForegroundColor Green
    }
} catch {
    Write-Host "   [INFO] No se pudieron verificar servicios (requiere permisos de administrador)" -ForegroundColor Yellow
}

# 4. Verificar puerto 5432
Write-Host ""
Write-Host "4. Verificando puerto 5432..." -ForegroundColor Yellow
try {
    $port5432 = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
    if ($port5432) {
        Write-Host "   [ADVERTENCIA] Puerto 5432 esta en uso" -ForegroundColor Yellow
        Write-Host "   PID: $($port5432.OwningProcess)" -ForegroundColor Yellow
        $process = Get-Process -Id $port5432.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "   Proceso: $($process.ProcessName)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   [OK] Puerto 5432 esta libre" -ForegroundColor Green
    }
} catch {
    Write-Host "   [INFO] No se pudo verificar el puerto (requiere permisos de administrador)" -ForegroundColor Yellow
}

# 5. Verificar conexion a Docker Postgres
Write-Host ""
Write-Host "5. Verificando conexion a Docker Postgres..." -ForegroundColor Yellow
try {
    $testConnection = docker exec ce_postgres psql -U ce -d comercial_electrica -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Conexion exitosa a Docker Postgres" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] No se pudo conectar a Docker Postgres" -ForegroundColor Red
        Write-Host "   Error: $testConnection" -ForegroundColor Red
    }
} catch {
    Write-Host "   [ERROR] Error al verificar conexion: $_" -ForegroundColor Red
}

# 6. Verificar archivo .env
Write-Host ""
Write-Host "6. Verificando configuracion .env..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envPath) {
    Write-Host "   [OK] Archivo .env existe" -ForegroundColor Green
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "DATABASE_URL.*postgresql://ce:ce_password@localhost:5432/comercial_electrica") {
        Write-Host "   [OK] DATABASE_URL esta configurada correctamente" -ForegroundColor Green
    } else {
        Write-Host "   [ADVERTENCIA] DATABASE_URL puede no estar configurada correctamente" -ForegroundColor Yellow
        Write-Host "   Valor esperado: postgresql://ce:ce_password@localhost:5432/comercial_electrica" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ERROR] Archivo .env NO existe" -ForegroundColor Red
    Write-Host "   Solucion: Copia env.example a .env y configura DATABASE_URL" -ForegroundColor Yellow
}

# Resumen y recomendaciones
Write-Host ""
Write-Host "=== RESUMEN Y RECOMENDACIONES ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si hay conflictos:" -ForegroundColor Yellow
Write-Host "1. Deten el servicio de PostgreSQL de Windows (services.msc)" -ForegroundColor White
Write-Host "2. Ejecuta: docker compose -f infra/docker-compose.yml down -v" -ForegroundColor White
Write-Host "3. Ejecuta: npm run db:up" -ForegroundColor White
Write-Host "4. Ejecuta: npm run prisma:migrate" -ForegroundColor White
Write-Host ""
