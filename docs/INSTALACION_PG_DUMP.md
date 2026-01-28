# Instalación de pg_dump en Windows

## Opción 1: Instalar solo herramientas de PostgreSQL (Recomendado)

### Con Chocolatey (requiere ejecutar PowerShell como Administrador):

```powershell
# Abrir PowerShell como Administrador y ejecutar:
choco install postgresql-tools -y
```

### Manualmente:

1. Descargar PostgreSQL desde: https://www.postgresql.org/download/windows/
2. Durante la instalación, seleccionar **solo** las herramientas (Command Line Tools)
3. O descargar directamente: https://www.enterprisedb.com/download-postgresql-binaries

## Opción 2: Instalar PostgreSQL completo

Si necesitas el servidor completo:

```powershell
# Con Chocolatey (como Administrador):
choco install postgresql --params '/Password:postgres' -y
```

## Verificar instalación

Después de instalar, verificar que `pg_dump` esté disponible:

```powershell
pg_dump --version
```

Si no funciona, puede ser necesario agregar PostgreSQL al PATH:
- Buscar la carpeta de instalación (normalmente `C:\Program Files\PostgreSQL\XX\bin`)
- Agregar esa ruta al PATH del sistema

## Nota Importante

**Para los tests e2e, NO es necesario instalar pg_dump** - los tests ya están configurados para funcionar sin él.

**Solo necesitas pg_dump si quieres que la funcionalidad de backups funcione realmente en producción.**
