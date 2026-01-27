# 🔧 Solución: Error EPERM con Prisma Generate

## ❌ Error Común

```
EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'
```

Este error ocurre cuando Prisma intenta generar el cliente pero no puede renombrar/reemplazar el archivo porque está siendo usado por otro proceso.

---

## 🔍 Causas Comunes

1. **OneDrive sincronizando** la carpeta del proyecto
2. **Antivirus** bloqueando archivos `.dll.node`
3. **Cursor/VS Code** con archivos abiertos o procesos corriendo
4. **Procesos de Node.js** aún ejecutándose
5. **Permisos insuficientes** en la carpeta

---

## ✅ Soluciones (Probar en Orden)

### **Solución 1: Cerrar Procesos y Reintentar** ⭐ (Más Rápida)

```powershell
# 1. Cerrar TODOS los procesos de Node.js
taskkill /F /IM node.exe

# 2. Cerrar Cursor/VS Code completamente

# 3. Volver a abrir Cursor/VS Code

# 4. Ir a la raíz del proyecto
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica

# 5. Eliminar la carpeta .prisma problemática
cd apps/api
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue

# 6. Volver a la raíz y regenerar
cd ..\..
npm run prisma:generate -w api
```

---

### **Solución 2: Ejecutar PowerShell como Administrador** ⭐⭐

```powershell
# 1. Cerrar PowerShell actual

# 2. Click derecho en PowerShell → "Ejecutar como administrador"

# 3. Ir al proyecto
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica

# 4. Eliminar carpeta .prisma
cd apps/api
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
cd ..\..

# 5. Regenerar Prisma
npm run prisma:generate -w api
```

---

### **Solución 3: Desactivar OneDrive Temporalmente** ⭐⭐⭐

Si tu proyecto está en OneDrive, puede estar bloqueando archivos:

```powershell
# 1. Cerrar OneDrive temporalmente
# Click derecho en el ícono de OneDrive en la barra de tareas → "Cerrar OneDrive"

# 2. Esperar unos segundos

# 3. Eliminar carpeta .prisma
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\apps\api
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue

# 4. Regenerar Prisma
cd ..\..
npm run prisma:generate -w api

# 5. Volver a abrir OneDrive cuando termine
```

---

### **Solución 4: Excluir Carpeta del Antivirus** ⭐⭐⭐⭐

Si tienes Windows Defender u otro antivirus:

1. Abrir **Windows Security** (Seguridad de Windows)
2. Ir a **Virus & threat protection**
3. Click en **Manage settings** bajo "Virus & threat protection settings"
4. Click en **Add or remove exclusions**
5. Agregar exclusión para la carpeta:
   ```
   C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\apps\api\node_modules\.prisma
   ```

Luego intentar de nuevo:
```powershell
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica
cd apps/api
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
cd ..\..
npm run prisma:generate -w api
```

---

### **Solución 5: Mover Proyecto Fuera de OneDrive** ⭐⭐⭐⭐⭐ (Más Permanente)

Si OneDrive sigue causando problemas:

```powershell
# 1. Mover el proyecto a una carpeta fuera de OneDrive
# Por ejemplo: C:\Proyectos\Comercial-Electrica

# 2. Actualizar la ruta en Cursor/VS Code

# 3. Regenerar Prisma desde la nueva ubicación
```

---

### **Solución 6: Reinstalar node_modules** (Último Recurso)

```powershell
# 1. Cerrar Cursor/VS Code completamente

# 2. Eliminar node_modules y package-lock.json
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica\apps\api
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# 3. Volver a la raíz
cd ..\..

# 4. Reinstalar dependencias
npm install

# 5. Regenerar Prisma
npm run prisma:generate -w api
```

---

## 🎯 Solución Recomendada (Combinación)

La combinación más efectiva suele ser:

```powershell
# 1. Cerrar todos los procesos
taskkill /F /IM node.exe

# 2. Cerrar Cursor/VS Code

# 3. Ejecutar PowerShell como Administrador

# 4. Ir al proyecto
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica

# 5. Eliminar carpeta problemática
cd apps/api
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
cd ..\..

# 6. Regenerar Prisma
npm run prisma:generate -w api

# 7. Si aún falla, cerrar OneDrive temporalmente y repetir paso 6
```

---

## ✅ Verificación

Después de aplicar cualquier solución, verifica que funcionó:

```powershell
# Verificar que se generó el cliente Prisma
cd apps/api
dir node_modules\.prisma\client\query_engine-windows.dll.node

# Si el archivo existe, ¡funcionó!
```

---

## 🔄 Prevención Futura

Para evitar este problema en el futuro:

1. **Excluir la carpeta del proyecto de OneDrive** (o moverla fuera)
2. **Agregar exclusiones en el antivirus** para `node_modules\.prisma`
3. **Cerrar procesos de Node.js** antes de regenerar Prisma
4. **Usar un proyecto fuera de OneDrive** para desarrollo

---

## 📝 Notas

- Este error es común en Windows, especialmente con OneDrive
- No afecta la funcionalidad del proyecto, solo la generación del cliente
- Una vez resuelto, normalmente no vuelve a ocurrir
- Si persiste, considera mover el proyecto fuera de OneDrive

---

**Última actualización:** Enero 2026
