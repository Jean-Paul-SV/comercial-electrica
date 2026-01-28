# 🚀 Pasos para Instalar Dependencias (Fuera de OneDrive)

## ✅ **Paso 1: Limpiar node_modules y caché**

Si ya tienes un `node_modules` corrupto, elimínalo primero:

```powershell
# Desde la raíz del proyecto
cd "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"

# Eliminar node_modules si existe
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "✓ node_modules eliminado"
}

# Limpiar caché de npm
npm cache clean --force
Write-Host "✓ Caché de npm limpiado"
```

---

## ✅ **Paso 2: Instalar dependencias de la API**

```powershell
# Ir a la carpeta de la API
cd apps\api

# Instalar dependencias
npm install

# Si aparece algún error de peer dependencies, usar:
# npm install --legacy-peer-deps
```

---

## ✅ **Paso 3: Verificar instalación**

```powershell
# Verificar que las dependencias se instalaron correctamente
npm list --depth=0

# Verificar que Swagger está instalado
npm list @nestjs/swagger
```

---

## ✅ **Paso 4: Generar cliente de Prisma**

```powershell
# Generar el cliente de Prisma
npm run prisma:generate
```

---

## ✅ **Paso 5: Verificar que todo funciona**

```powershell
# Intentar compilar el proyecto
npm run build

# Si compila sin errores, todo está bien ✅
```

---

## 🎯 **Comandos Rápidos (Todo en uno)**

Si prefieres ejecutar todo de una vez:

```powershell
# Desde la raíz del proyecto
cd "C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica"

# Limpiar
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
npm cache clean --force

# Instalar
cd apps\api
npm install

# Generar Prisma
npm run prisma:generate

# Verificar
npm run build
```

---

## 🐛 **Si aparece algún error:**

### Error de permisos:
- Cerrar Cursor/VS Code
- Ejecutar PowerShell como Administrador
- Repetir los pasos

### Error de peer dependencies:
```powershell
npm install --legacy-peer-deps
```

### Error de Prisma:
```powershell
# Asegúrate de que Docker esté corriendo
npm run db:up

# Luego generar Prisma
npm run prisma:generate
```

---

## ✅ **Una vez instalado correctamente:**

1. **Iniciar la API:**
   ```powershell
   npm run dev
   ```

2. **Acceder a Swagger:**
   - Abrir: `http://localhost:3000/api/docs`

3. **Probar endpoints desde Swagger UI**

---

**¡Listo! Ahora deberías poder instalar sin problemas de permisos.**
