# Script: instalar-todo.ps1
# Instala dependencias, configura .env, levanta Docker, aplica migraciones y opcionalmente seed.
# Ejecutar desde la raíz del proyecto o desde scripts/ (ajusta la ruta).
# Requisitos: Node.js 18+, npm, Docker Desktop (con WSL actualizado).

$ErrorActionPreference = "Stop"
$here = (Get-Location).Path
$ProjectRoot = if (Test-Path (Join-Path $here "package.json")) { $here } else { (Resolve-Path (Join-Path $here "..")).Path }
Set-Location $ProjectRoot

Write-Host "=== Proyecto: Comercial Electrica - Instalacion ===" -ForegroundColor Cyan
Write-Host "Raiz del proyecto: $ProjectRoot`n" -ForegroundColor Gray

# 1) Comprobar Node/npm
Write-Host "[1/7] Comprobando Node.js y npm..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    $npmVersion = npm --version 2>$null
    if (-not $nodeVersion -or -not $npmVersion) { throw "Node o npm no encontrados" }
    Write-Host "  OK - Node $nodeVersion, npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js o npm no estan en el PATH." -ForegroundColor Red
    Write-Host "  Instala Node.js 18+ desde https://nodejs.org y reinicia la terminal." -ForegroundColor Red
    exit 1
}

# 2) Crear .env si no existe
Write-Host "`n[2/7] Archivo .env..." -ForegroundColor Yellow
if (-not (Test-Path ".\.env")) {
    Copy-Item ".\env.example" ".\.env"
    Write-Host "  OK - Creado .env desde env.example" -ForegroundColor Green
} else {
    Write-Host "  OK - .env ya existe" -ForegroundColor Green
}

# 3) npm install
Write-Host "`n[3/7] Instalando dependencias (npm install)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR en npm install" -ForegroundColor Red; exit 1 }
Write-Host "  OK - Dependencias instaladas" -ForegroundColor Green

# 4) Prisma generate
Write-Host "`n[4/7] Generando cliente Prisma..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Si ves EPERM: cierra Cursor/VS Code, abre PowerShell como Administrador y vuelve a ejecutar." -ForegroundColor Red
    exit 1
}
Write-Host "  OK - Cliente Prisma generado" -ForegroundColor Green

# 5) Docker (Postgres + Redis)
Write-Host "`n[5/7] Levantando Postgres y Redis (Docker)..." -ForegroundColor Yellow
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  AVISO: Docker no esta en ejecucion o no esta instalado." -ForegroundColor Red
    Write-Host "  Abre Docker Desktop (y actualiza WSL con: wsl --update si es necesario)." -ForegroundColor Red
    Write-Host "  Luego ejecuta manualmente: npm run db:up" -ForegroundColor Yellow
} else {
    npm run db:up
    Write-Host "  Esperando 15 segundos a que Postgres y Redis esten listos..." -ForegroundColor Gray
    Start-Sleep -Seconds 15
    Write-Host "  OK - Contenedores levantados" -ForegroundColor Green
}

# 6) Migraciones
Write-Host "`n[6/7] Aplicando migraciones a la base de datos..." -ForegroundColor Yellow
npm run prisma:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Si falla por conexion: asegurate de que Docker este corriendo y que ce_postgres este activo (docker ps)." -ForegroundColor Red
    exit 1
}
Write-Host "  OK - Migraciones aplicadas" -ForegroundColor Green

# 7) Seed (opcional)
Write-Host "`n[7/7] Datos iniciales (usuario admin y datos de prueba)..." -ForegroundColor Yellow
$seed = Read-Host "  ¿Ejecutar seed? (crea admin@example.com / Admin123!) [S/n]"
if ($seed -eq "" -or $seed -eq "S" -or $seed -eq "s") {
    npm run db:seed
    Write-Host "  OK - Seed ejecutado. Usuario: admin@example.com / Admin123!" -ForegroundColor Green
} else {
    Write-Host "  Omitido. Puedes ejecutar luego: npm run db:seed" -ForegroundColor Gray
}

Write-Host "`n=== Instalacion completada ===" -ForegroundColor Cyan
Write-Host "Para arrancar API y Frontend:" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor Green
Write-Host "`nURLs:" -ForegroundColor White
Write-Host "  API:       http://localhost:3000" -ForegroundColor Gray
Write-Host "  Health:    http://localhost:3000/health" -ForegroundColor Gray
Write-Host "  Swagger:   http://localhost:3000/api/docs" -ForegroundColor Gray
Write-Host "  Frontend:  http://localhost:3001" -ForegroundColor Gray
Write-Host ""
