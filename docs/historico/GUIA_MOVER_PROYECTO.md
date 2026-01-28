# 📦 Guía: Mover Proyecto Fuera de OneDrive

> **Fecha:** Enero 2026  
> **Motivo:** Resolver problemas de EPERM con Prisma y evitar conflictos de sincronización de OneDrive

---

## 🎯 **¿Por qué mover el proyecto?**

### **Problemas actuales con OneDrive:**

1. ❌ **Bloqueos de archivos** - OneDrive sincroniza archivos y puede bloquear operaciones de Prisma
2. ❌ **Errores EPERM** - Windows no puede renombrar archivos mientras OneDrive los está sincronizando
3. ❌ **Rendimiento lento** - OneDrive escanea constantemente `node_modules` (miles de archivos)
4. ❌ **Conflictos de sincronización** - Cambios en `package-lock.json` pueden causar conflictos
5. ❌ **Consumo de espacio en la nube** - `node_modules` no debería estar en la nube

### **Beneficios de mover fuera de OneDrive:**

1. ✅ **Sin bloqueos de archivos** - Prisma funcionará sin problemas
2. ✅ **Mejor rendimiento** - Sin escaneo constante de OneDrive
3. ✅ **Menos errores** - No más EPERM durante `prisma generate`
4. ✅ **Control total** - Solo sincronizas lo que quieres (usando Git)

---

## 📍 **Ubicaciones Recomendadas**

### **Opción 1: `C:\dev\Comercial-Electrica` ⭐ (Recomendada)**

**Ventajas:**
- Ruta corta y clara
- Estándar para desarrolladores
- Fuera de cualquier carpeta de usuario

**Comando:**
```powershell
C:\dev\Comercial-Electrica
```

### **Opción 2: `C:\proyectos\Comercial-Electrica`**

**Ventajas:**
- Nombre descriptivo en español
- Fácil de encontrar

**Comando:**
```powershell
C:\proyectos\Comercial-Electrica
```

### **Opción 3: `C:\workspace\Comercial-Electrica`**

**Ventajas:**
- Nombre genérico para múltiples proyectos
- Estándar en algunos entornos

**Comando:**
```powershell
C:\workspace\Comercial-Electrica
```

### **Opción 4: `C:\Users\paulk\Documents\Proyectos\Comercial-Electrica`**

**Solo si Documents NO está en OneDrive**

**Verificar:**
```powershell
# Verificar si Documents está en OneDrive
Test-Path "$env:USERPROFILE\OneDrive\Documents"
```

Si retorna `False`, esta opción es válida.

---

## 🚀 **PASO A PASO: Mover el Proyecto**

### **PASO 1: Cerrar Cursor y Procesos**

1. **Cierra completamente Cursor/VS Code**
2. **Cierra cualquier terminal abierta**
3. **Verifica que no hay procesos de Node.js:**
   ```powershell
   Get-Process -Name node -ErrorAction SilentlyContinue
   ```
   Si hay procesos, ciérralos:
   ```powershell
   Stop-Process -Name node -Force
   ```

---

### **PASO 2: Crear Carpeta de Destino**

Elige una de las opciones recomendadas y crea la carpeta:

**Opción 1 (Recomendada):**
```powershell
New-Item -ItemType Directory -Path "C:\dev" -Force
New-Item -ItemType Directory -Path "C:\dev\Comercial-Electrica" -Force
```

**Opción 2:**
```powershell
New-Item -ItemType Directory -Path "C:\proyectos" -Force
New-Item -ItemType Directory -Path "C:\proyectos\Comercial-Electrica" -Force
```

**Opción 3:**
```powershell
New-Item -ItemType Directory -Path "C:\workspace" -Force
New-Item -ItemType Directory -Path "C:\workspace\Comercial-Electrica" -Force
```

---

### **PASO 3: Copiar el Proyecto (Excluyendo node_modules y .git)**

**⚠️ IMPORTANTE:** No copiamos `node_modules` ni `.git` para evitar problemas.

**Usando robocopy (Recomendado):**

```powershell
# Navegar a la ubicación actual
cd "C:\Users\paulk\OneDrive\Escritorio\Proyecto"

# Copiar proyecto (excluyendo node_modules, .git, y otros archivos temporales)
robocopy "Comercial-Electrica" "C:\dev\Comercial-Electrica" /E /XD node_modules .git .prisma dist coverage /XF package-lock.json
```

**O usando PowerShell (Alternativa):**

```powershell
# Crear función para copiar excluyendo carpetas
$source = "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"
$dest = "C:\dev\Comercial-Electrica"

# Copiar archivos y carpetas (excluyendo node_modules, .git, etc.)
Get-ChildItem -Path $source -Recurse | 
    Where-Object { 
        $_.FullName -notmatch '\\node_modules\\' -and 
        $_.FullName -notmatch '\\.git\\' -and
        $_.FullName -notmatch '\\.prisma\\' -and
        $_.FullName -notmatch '\\dist\\' -and
        $_.FullName -notmatch '\\coverage\\'
    } | 
    Copy-Item -Destination { $_.FullName.Replace($source, $dest) } -Force
```

---

### **PASO 4: Copiar .git Manualmente (Si usas Git)**

Si quieres mantener el historial de Git:

```powershell
# Copiar carpeta .git
robocopy "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\.git" "C:\dev\Comercial-Electrica\.git" /E
```

**O si prefieres empezar limpio:**

```powershell
# Inicializar nuevo repositorio Git en la nueva ubicación
cd "C:\dev\Comercial-Electrica"
git init
git remote add origin <URL_DEL_REPOSITORIO>
```

---

### **PASO 5: Verificar que se Copió Correctamente**

```powershell
cd "C:\dev\Comercial-Electrica"

# Verificar estructura
dir

# Deberías ver:
# - apps/
# - docs/
# - infra/
# - package.json
# - README.md
# - etc.
```

---

### **PASO 6: Reinstalar Dependencias en la Nueva Ubicación**

```powershell
cd "C:\dev\Comercial-Electrica"

# Limpiar cache de npm
npm cache clean --force

# Instalar dependencias
npm install
```

---

### **PASO 7: Generar Cliente de Prisma**

```powershell
# Desde la nueva ubicación
npm run prisma:generate -w api
```

**✅ Ahora debería funcionar sin errores EPERM!**

---

### **PASO 8: Abrir Proyecto en Cursor**

1. **Abre Cursor**
2. **File → Open Folder**
3. **Navega a:** `C:\dev\Comercial-Electrica`
4. **Abre la carpeta**

---

### **PASO 9: Actualizar Rutas en Documentación (Opcional)**

Si tienes documentación con rutas absolutas, actualízalas:

```powershell
# Buscar y reemplazar rutas en archivos de documentación
cd "C:\dev\Comercial-Electrica\docs"
Get-ChildItem -Recurse -Filter "*.md" | ForEach-Object {
    (Get-Content $_.FullName) -replace 'C:\\Users\\paulk\\OneDrive\\Escritorio\\Proyecto\\Comercial-Electrica', 'C:\dev\Comercial-Electrica' | Set-Content $_.FullName
}
```

---

### **PASO 10: Eliminar Proyecto Antiguo (Después de Verificar)**

**⚠️ IMPORTANTE:** Solo haz esto después de verificar que todo funciona en la nueva ubicación.

```powershell
# Verificar que todo funciona primero
cd "C:\dev\Comercial-Electrica"
npm run prisma:generate -w api  # Debe funcionar sin errores

# Si todo funciona, eliminar el proyecto antiguo
Remove-Item -Recurse -Force "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"
```

**O mejor aún, renómbralo como backup:**

```powershell
Rename-Item "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica" "Comercial-Electrica-BACKUP"
```

---

## ✅ **Verificación Final**

Después de mover el proyecto, verifica que todo funciona:

```powershell
cd "C:\dev\Comercial-Electrica"

# 1. Verificar dependencias
npm list --depth=0

# 2. Generar Prisma (debe funcionar sin EPERM)
npm run prisma:generate -w api

# 3. Verificar que el cliente se generó
Test-Path "apps\api\node_modules\.prisma\client\index.js"
# Debe retornar: True

# 4. Compilar el proyecto
npm run build -w api

# 5. Ejecutar tests (si los tienes)
npm run test -w api
```

---

## 🔄 **Configurar Git en la Nueva Ubicación**

Si moviste el proyecto y quieres mantener Git:

```powershell
cd "C:\dev\Comercial-Electrica"

# Verificar estado
git status

# Si todo está bien, hacer commit de cualquier cambio
git add .
git commit -m "chore: mover proyecto fuera de OneDrive"
```

---

## 🎯 **Recomendaciones Adicionales**

### **1. Excluir node_modules de OneDrive (Si mantienes algo en OneDrive)**

Si tienes otros proyectos en OneDrive, agrega exclusiones:

1. Abre **OneDrive Settings**
2. Ve a **Sync and backup** → **Advanced settings**
3. Agrega exclusiones para:
   - `node_modules`
   - `.prisma`
   - `dist`
   - `coverage`

### **2. Usar Git para Sincronización**

En lugar de OneDrive, usa Git para sincronizar tu código:

```powershell
# Hacer commit regularmente
git add .
git commit -m "tus cambios"
git push origin main
```

### **3. Backup Regular**

Aunque no uses OneDrive, haz backups regulares:

```powershell
# Crear backup del proyecto
Compress-Archive -Path "C:\dev\Comercial-Electrica" -DestinationPath "C:\Backups\Comercial-Electrica-$(Get-Date -Format 'yyyy-MM-dd').zip"
```

---

## 📝 **Resumen de Comandos (Opción 1 - Recomendada)**

```powershell
# 1. Cerrar procesos
Stop-Process -Name node -Force -ErrorAction SilentlyContinue

# 2. Crear carpeta destino
New-Item -ItemType Directory -Path "C:\dev\Comercial-Electrica" -Force

# 3. Copiar proyecto
robocopy "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica" "C:\dev\Comercial-Electrica" /E /XD node_modules .git .prisma dist coverage

# 4. Copiar .git (opcional)
robocopy "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\.git" "C:\dev\Comercial-Electrica\.git" /E

# 5. Ir a nueva ubicación
cd "C:\dev\Comercial-Electrica"

# 6. Instalar dependencias
npm install

# 7. Generar Prisma
npm run prisma:generate -w api

# 8. Verificar
Test-Path "apps\api\node_modules\.prisma\client\index.js"
```

---

## 🆘 **Solución de Problemas**

### **Error: "Access Denied" al copiar**

**Solución:** Ejecuta PowerShell como Administrador

### **Error: "Path too long"**

**Solución:** Usa `robocopy` con la opción `/256` o mueve a una ruta más corta

### **Error: "OneDrive still syncing"**

**Solución:** 
1. Pausa OneDrive temporalmente
2. Copia el proyecto
3. Reanuda OneDrive

---

**Última actualización:** Enero 2026
