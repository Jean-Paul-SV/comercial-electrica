# Ejecuta el seed de Prisma contra la base de datos de PRODUCCION (Render).
# Crea/actualiza: tenant por defecto, plan "Todo incluido", permisos, roles (admin/user),
# y el usuario platform@admin.local (contraseña: PlatformAdmin1!) si no existe.
#
# Uso:
#   1. Copia la "External Database URL" de Render (comercial-electrica-db -> Connect) para ejecutar desde tu PC.
#   2. En PowerShell: cd apps\api; .\scripts\seed-production.ps1
#   3. Cuando pida la URL, pega la que copiaste y pulsa Enter.

$url = Read-Host "Pega la External Database URL de Render (postgresql://...) y pulsa Enter"
if ([string]::IsNullOrWhiteSpace($url)) {
    Write-Host "No se ingresó URL. Saliendo." -ForegroundColor Red
    exit 1
}
$url = $url.Trim('"').Trim("'")

# Si la URL usa el host interno de Render (dpg-xxx-a sin dominio), convertir a host externo para conectar desde tu PC
if ($url -match '@(dpg-[a-z0-9]+-a)(:\d+)?/') {
    $shortHost = $Matches[1]
    if ($shortHost -notmatch '\.') {
        $url = $url -replace ([regex]::Escape($shortHost) + '(:\d+)?'), ($shortHost + '.oregon-postgres.render.com:5432')
        Write-Host "URL ajustada para conexión externa (host completo de Render)." -ForegroundColor Yellow
    }
}

$repoRoot = (Get-Item $PSScriptRoot).Parent.Parent.Parent.FullName
$envPath = Join-Path $repoRoot ".env"
$envBackup = Join-Path $repoRoot ".env.local.backup"
if (Test-Path $envPath) {
    Rename-Item -Path $envPath -NewName ".env.local.backup" -Force
    Write-Host "Archivo .env desactivado temporalmente (para usar la URL de producción)." -ForegroundColor Yellow
}

try {
    $env:DATABASE_URL = $url
    $env:SEED_PLANS_ONLY = "true"
    Write-Host "Ejecutando: npx prisma db seed (solo planes; se eliminan platform@proveedor.local y admin@negocio.local)" -ForegroundColor Cyan
    npx prisma db seed
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Seed completado. Planes actualizados; usuarios de prueba eliminados si existían." -ForegroundColor Green
        Write-Host ""
    }
} finally {
    if (Test-Path $envBackup) {
        Rename-Item -Path $envBackup -NewName ".env" -Force
        Write-Host "Archivo .env restaurado." -ForegroundColor Yellow
    }
}
