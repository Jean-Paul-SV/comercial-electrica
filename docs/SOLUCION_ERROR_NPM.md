# 🔧 Solución: Error npm "Cannot read properties of null (reading 'location')"

> **Error:** `npm error Cannot read properties of null (reading 'location')`  
> **Causa común:** Problemas con workspaces de npm o package-lock.json corrupto

---

## 🚨 **SOLUCIÓN RÁPIDA**

### **Opción 1: Limpiar y Reinstalar (Recomendado)**

```powershell
# 1. Limpiar caché de npm
npm cache clean --force

# 2. Eliminar package-lock.json y node_modules
cd "c:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"
Remove-Item package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# 3. Eliminar node_modules de apps/api también
Remove-Item -Recurse -Force apps\api\node_modules -ErrorAction SilentlyContinue
Remove-Item apps\api\package-lock.json -ErrorAction SilentlyContinue

# 4. Reinstalar dependencias
npm install
```

---

### **Opción 2: Reinstalar Solo en apps/api**

Si el error ocurre al ejecutar comandos desde `apps/api`:

```powershell
cd apps/api

# Eliminar node_modules local
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue

# Volver a la raíz e instalar
cd ..\..
npm install
```

---

### **Opción 3: Usar npm ci (Clean Install)**

```powershell
# Desde la raíz del proyecto
npm ci --force
```

---

## 🔍 **VERIFICAR LA CAUSA**

### **1. Verificar versión de npm**

```powershell
npm --version
```

**Si es menor a 9.0.0:** Actualizar npm:
```powershell
npm install -g npm@latest
```

### **2. Verificar estructura de workspaces**

El archivo `package.json` en la raíz debe tener:

```json
{
  "workspaces": [
    "apps/*"
  ]
}
```

### **3. Verificar que no hay conflictos**

```powershell
# Verificar estructura de carpetas
dir apps
dir apps\api
dir apps\web  # Si existe
```

---

## 🛠️ **SOLUCIONES ADICIONALES**

### **Si el error persiste:**

#### **1. Actualizar npm a la última versión**

```powershell
npm install -g npm@latest
```

#### **2. Usar yarn en lugar de npm (alternativa)**

```powershell
# Instalar yarn globalmente
npm install -g yarn

# Usar yarn en lugar de npm
yarn install
```

#### **3. Verificar permisos**

```powershell
# Ejecutar PowerShell como Administrador
# Luego repetir los pasos de limpieza
```

#### **4. Verificar variables de entorno**

```powershell
# Verificar que npm está configurado correctamente
npm config list

# Si hay problemas, resetear configuración
npm config delete registry
npm config set registry https://registry.npmjs.org/
```

---

## 📝 **PASOS COMPLETOS DE RECUPERACIÓN**

Si nada funciona, sigue estos pasos en orden:

```powershell
# 1. Cerrar todas las instancias de Node.js y editores
# (Cursor, VS Code, terminales, etc.)

# 2. Abrir PowerShell como Administrador

# 3. Navegar al proyecto
cd "c:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"

# 4. Limpiar todo
npm cache clean --force
Remove-Item package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps\api\node_modules -ErrorAction SilentlyContinue
Remove-Item apps\api\package-lock.json -ErrorAction SilentlyContinue

# 5. Actualizar npm
npm install -g npm@latest

# 6. Reinstalar
npm install

# 7. Verificar instalación
npm list --depth=0
```

---

## ✅ **VERIFICAR QUE FUNCIONA**

Después de la reinstalación:

```powershell
# Verificar que las dependencias están instaladas
npm list --depth=0

# Verificar que los scripts funcionan
npm run --workspace=api prisma:generate
```

---

## 🎯 **PREVENCIÓN**

Para evitar este error en el futuro:

1. **No editar manualmente** `package-lock.json`
2. **Usar siempre** `npm install` desde la raíz del proyecto
3. **No mezclar** npm y yarn en el mismo proyecto
4. **Mantener npm actualizado**: `npm install -g npm@latest`

---

## 📚 **REFERENCIAS**

- [npm workspaces documentation](https://docs.npmjs.com/cli/v9/using-npm/workspaces)
- [npm cache documentation](https://docs.npmjs.com/cli/v9/commands/npm-cache)

---

**¿Sigue sin funcionar?** Intenta usar yarn como alternativa o verifica que no haya problemas con OneDrive sincronizando los archivos.

---

## 🔧 **Error: EPERM en Prisma Generate**

> **Error:** `EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'`  
> **Causa común:** Archivo bloqueado por Windows Defender, antivirus, o proceso del sistema

### **SOLUCIÓN RÁPIDA**

#### **Opción 1: Cerrar Cursor y Ejecutar como Administrador (Recomendado)**

1. **Cierra completamente Cursor/VS Code**
2. **Abre PowerShell como Administrador** (clic derecho → "Ejecutar como administrador")
3. **Navega al proyecto:**
   ```powershell
   cd "c:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"
   ```
4. **Ejecuta Prisma Generate:**
   ```powershell
   npm run prisma:generate -w api
   ```

#### **Opción 2: Esperar y Reintentar**

A veces Windows Defender está escaneando el archivo. Espera 1-2 minutos y vuelve a intentar:

```powershell
npm run prisma:generate -w api
```

#### **Opción 3: Excluir Carpeta del Antivirus**

1. Abre **Windows Defender** o tu antivirus
2. Agrega una excepción para la carpeta:
   ```
   C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\apps\api\node_modules\.prisma
   ```

#### **Opción 4: Eliminar Carpeta .prisma Manualmente**

```powershell
# Cerrar Cursor primero
Remove-Item -Recurse -Force "apps\api\node_modules\.prisma" -ErrorAction SilentlyContinue
npm run prisma:generate -w api
```

#### **Opción 5: Verificar que .env Existe**

El script requiere el archivo `.env` en la raíz:

```powershell
# Si no existe, créalo desde env.example
Copy-Item "env.example" ".env"
npm run prisma:generate -w api
```

#### **Opción 6: Desactivar Temporalmente Windows Defender (Solo para este paso)**

⚠️ **ADVERTENCIA:** Solo haz esto temporalmente y vuelve a activarlo después.

1. Abre **Windows Security** (Seguridad de Windows)
2. Ve a **Virus & threat protection** (Protección contra virus y amenazas)
3. Clic en **Manage settings** (Administrar configuración)
4. Desactiva temporalmente **Real-time protection** (Protección en tiempo real)
5. Ejecuta: `npm run prisma:generate -w api`
6. **Vuelve a activar** la protección inmediatamente después

#### **Opción 7: Agregar Excepción en Windows Defender (Recomendado a Largo Plazo)**

1. Abre **Windows Security**
2. Ve a **Virus & threat protection** → **Manage settings**
3. Desplázate hasta **Exclusions** (Exclusiones) → **Add or remove exclusions**
4. Clic en **Add an exclusion** → **Folder**
5. Agrega esta carpeta:
   ```
   C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\apps\api\node_modules\.prisma
   ```

#### **Opción 8: Usar WSL (Windows Subsystem for Linux)**

Si tienes WSL instalado, puedes ejecutar Prisma desde Linux donde no hay este problema:

```bash
# Desde WSL
cd /mnt/c/Users/paulk/OneDrive/Escritorio/Proyecto/Comercial-Electrica
npm run prisma:generate -w api
```

---

## ⚠️ **PROBLEMA CONOCIDO**

Este es un problema conocido de Prisma en Windows relacionado con permisos del sistema operativo al renombrar archivos DLL. La solución más efectiva es **ejecutar como Administrador** (Opción 1).

---

## ✅ **VERIFICAR QUE FUNCIONA**

Después de ejecutar `prisma:generate`, verifica que se creó el cliente:

```powershell
Test-Path "apps\api\node_modules\.prisma\client\index.js"
```

Debería retornar `True`.

**Si el error persiste después de intentar todas las opciones:**

1. Reinicia tu computadora
2. Abre PowerShell como Administrador inmediatamente después del reinicio
3. Ejecuta `npm run prisma:generate -w api` antes de abrir cualquier otro programa
