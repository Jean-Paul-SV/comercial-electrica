# Ejecuta "prisma migrate resolve --rolled-back" contra la base de PRODUCCION (Render).
# Uso:
#   1. Copia la "Internal Database URL" de Render (comercial-electrica-db -> Connect).
#   2. En PowerShell: cd apps\api; .\scripts\resolve-migration-production.ps1
#   3. Cuando pida la URL, pega la que copiaste y pulsa Enter.

$migrationName = "20260206000000_fix_product_dictionary_category_id"

# Pedir la URL de producción (no se guarda en ningún archivo)
$url = Read-Host "Pega la Internal Database URL de Render (postgresql://...) y pulsa Enter"
if ([string]::IsNullOrWhiteSpace($url)) {
    Write-Host "No se ingresó URL. Saliendo." -ForegroundColor Red
    exit 1
}

# Desactivar .env local (está en la raíz del monorepo)
$repoRoot = (Get-Item $PSScriptRoot).Parent.Parent.Parent.FullName
$envPath = Join-Path $repoRoot ".env"
$envBackup = Join-Path $repoRoot ".env.local.backup"
if (Test-Path $envPath) {
    Rename-Item -Path $envPath -NewName ".env.local.backup" -Force
    Write-Host "Archivo .env desactivado temporalmente." -ForegroundColor Yellow
}

try {
    $env:DATABASE_URL = $url.Trim('"').Trim("'")
    Write-Host "Ejecutando: prisma migrate resolve --rolled-back $migrationName" -ForegroundColor Cyan
    npx prisma migrate resolve --rolled-back $migrationName
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Listo. Ahora en Render haz Manual Deploy." -ForegroundColor Green
    }
} finally {
    if (Test-Path $envBackup) {
        Rename-Item -Path $envBackup -NewName ".env" -Force
        Write-Host "Archivo .env restaurado." -ForegroundColor Yellow
    }
}
