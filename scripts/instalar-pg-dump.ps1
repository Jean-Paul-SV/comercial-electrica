# Script para instalar pg_dump en Windows
# Requiere Chocolatey instalado

Write-Host "=== Instalacion de pg_dump ===" -ForegroundColor Cyan
Write-Host ""

# Verificar si Chocolatey esta instalado
Write-Host "1. Verificando Chocolatey..." -ForegroundColor Yellow
try {
    $chocoVersion = choco --version
    Write-Host "   [OK] Chocolatey esta instalado: $chocoVersion" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Chocolatey no esta instalado" -ForegroundColor Red
    Write-Host "   Instala Chocolatey desde: https://chocolatey.org/install" -ForegroundColor Yellow
    exit 1
}

# Verificar si pg_dump ya esta instalado
Write-Host ""
Write-Host "2. Verificando si pg_dump ya esta instalado..." -ForegroundColor Yellow
try {
    $pgDumpVersion = pg_dump --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] pg_dump ya esta instalado: $pgDumpVersion" -ForegroundColor Green
        Write-Host "   No es necesario instalar nuevamente." -ForegroundColor Yellow
        exit 0
    }
} catch {
    Write-Host "   [INFO] pg_dump no encontrado, procediendo con instalacion..." -ForegroundColor Yellow
}

# Instalar PostgreSQL Client Tools (solo las herramientas, no el servidor completo)
Write-Host ""
Write-Host "3. Instalando PostgreSQL Client Tools..." -ForegroundColor Yellow
Write-Host "   Esto instalara solo las herramientas de cliente (pg_dump, psql, etc.)" -ForegroundColor White
Write-Host "   NO instalara el servidor PostgreSQL completo." -ForegroundColor White
Write-Host ""

try {
    # Instalar solo las herramientas de cliente
    choco install postgresql15 --params '/Password:""' --version=15.5.0 -y
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "   [OK] Instalacion completada" -ForegroundColor Green
        
        # Agregar al PATH de la sesion actual
        $pgPath = "C:\Program Files\PostgreSQL\15\bin"
        if (Test-Path $pgPath) {
            $env:Path += ";$pgPath"
            Write-Host "   [OK] Ruta agregada al PATH de esta sesion: $pgPath" -ForegroundColor Green
        }
        
        # Verificar instalacion
        Write-Host ""
        Write-Host "4. Verificando instalacion..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        
        # Refrescar PATH en nueva sesion
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        try {
            $pgDumpVersion = & "$pgPath\pg_dump.exe" --version
            Write-Host "   [OK] pg_dump instalado correctamente: $pgDumpVersion" -ForegroundColor Green
        } catch {
            Write-Host "   [ADVERTENCIA] pg_dump instalado pero requiere reiniciar PowerShell para estar en PATH" -ForegroundColor Yellow
            Write-Host "   Ruta completa: $pgPath\pg_dump.exe" -ForegroundColor White
        }
        
        Write-Host ""
        Write-Host "=== INSTALACION COMPLETADA ===" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "NOTA IMPORTANTE:" -ForegroundColor Yellow
        Write-Host "- Si pg_dump no funciona en esta sesion, cierra y abre PowerShell nuevamente" -ForegroundColor White
        Write-Host "- O usa la ruta completa: C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" -ForegroundColor White
        Write-Host ""
        Write-Host "Para verificar:" -ForegroundColor Yellow
        Write-Host "  pg_dump --version" -ForegroundColor White
        
    } else {
        Write-Host "   [ERROR] La instalacion fallo" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   [ERROR] Error durante la instalacion: $_" -ForegroundColor Red
    exit 1
}
