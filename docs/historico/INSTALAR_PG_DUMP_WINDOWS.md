# 🚀 Instalar pg_dump en Windows - Guía Paso a Paso

## ✅ Opción 1: Instalación Automática con Script (Recomendado)

### Paso 1: Ejecutar el script de instalación

Abre **PowerShell como Administrador** y ejecuta:

```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
.\scripts\instalar-pg-dump.ps1
```

El script:
- ✅ Verifica si Chocolatey está instalado
- ✅ Verifica si `pg_dump` ya está instalado
- ✅ Instala PostgreSQL Client Tools (solo herramientas, no el servidor)
- ✅ Agrega `pg_dump` al PATH

### Paso 2: Cerrar y reabrir PowerShell

Después de la instalación, **cierra y abre PowerShell nuevamente** para que el PATH se actualice.

### Paso 3: Verificar instalación

```powershell
pg_dump --version
```

Deberías ver:
```
pg_dump (PostgreSQL) 15.x
```

---

## ✅ Opción 2: Instalación Manual con Chocolatey

Si prefieres hacerlo manualmente:

### Paso 1: Abrir PowerShell como Administrador

### Paso 2: Instalar PostgreSQL Client Tools

```powershell
choco install postgresql15 --params '/Password:""' -y
```

**Nota:** El parámetro `/Password:""` evita que se configure una contraseña para el servidor (solo queremos las herramientas).

### Paso 3: Agregar al PATH (si no se agregó automáticamente)

```powershell
# Verificar si ya está en el PATH
$env:Path -split ';' | Where-Object { $_ -like "*PostgreSQL*" }

# Si no aparece, agregarlo manualmente (reemplaza 15 por tu versión)
$pgPath = "C:\Program Files\PostgreSQL\15\bin"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$pgPath", "User")
```

### Paso 4: Cerrar y reabrir PowerShell

### Paso 5: Verificar

```powershell
pg_dump --version
```

---

## ✅ Opción 3: Usar Docker (Ya implementado como fallback)

**¡Buenas noticias!** Ya modifiqué el código para que use Docker automáticamente si `pg_dump` no está disponible.

**Ventajas:**
- ✅ No requiere instalación
- ✅ Funciona inmediatamente si tienes Docker

**Desventajas:**
- ⚠️ Requiere Docker corriendo
- ⚠️ Es más lento que `pg_dump` nativo

**Cómo funciona:**
- El sistema detecta automáticamente si `pg_dump` está disponible
- Si no está, usa Docker con la imagen `postgres:15-alpine`
- No necesitas hacer nada, funciona automáticamente

---

## 🧪 Probar que Funciona

### Opción A: Probar desde la línea de comandos

```powershell
# Conectar a tu base de datos Docker
pg_dump -h localhost -p 5432 -U ce -d comercial_electrica -F c -f test_backup.sql

# Si pide contraseña, usa: ce_password
```

### Opción B: Probar desde la API

1. Inicia tu servidor:
```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\apps\api
npm run start:dev
```

2. En otra terminal, crea un backup:
```powershell
# Primero obtén un token de admin (login)
# Luego:
curl -X POST http://localhost:3000/backups `
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

### Opción C: Ejecutar los tests

```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\apps\api
npm run test:e2e -- backups.e2e-spec.ts
```

**Ahora los tests deberían crear backups reales** (no solo registros fallidos).

---

## 🔧 Solución de Problemas

### Problema: "pg_dump no se reconoce como comando"

**Solución 1:** Cerrar y reabrir PowerShell

**Solución 2:** Verificar que está en el PATH
```powershell
$env:Path -split ';' | Where-Object { $_ -like "*PostgreSQL*" }
```

**Solución 3:** Usar la ruta completa
```powershell
& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" --version
```

### Problema: "Error de conexión" al usar Docker fallback

Si usas Docker como fallback y falla la conexión:

1. Verifica que Docker está corriendo:
```powershell
docker ps
```

2. Verifica que el contenedor `ce_postgres` está corriendo:
```powershell
docker ps | Select-String "ce_postgres"
```

3. Si el host es `localhost`, Docker usa `host.docker.internal` automáticamente (ya está implementado).

---

## 📋 Resumen

**Para desarrollo rápido:** Usa la Opción 3 (Docker fallback) - ya está implementado, no necesitas hacer nada.

**Para producción:** Instala `pg_dump` usando la Opción 1 o 2 - es más eficiente y no depende de Docker.

**Recomendación:** Instala `pg_dump` ahora (Opción 1) para que todo funcione de forma nativa y más rápida.

---

**Fecha:** 2026-01-28  
**Estado:** Listo para usar
