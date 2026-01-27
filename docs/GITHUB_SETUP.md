# Guía para Subir el Proyecto a GitHub

## ✅ Checklist de Seguridad (ANTES de subir)

### 1. Verificar que NO se suban archivos sensibles

**Archivos que NO deben subirse:**
- ✅ `.env` - Ya está en `.gitignore`
- ✅ `node_modules/` - Ya está en `.gitignore`
- ✅ `dist/` - Ya está en `.gitignore`
- ✅ Archivos con contraseñas reales

**Archivos que SÍ deben subirse:**
- ✅ `env.example` - Template de variables de entorno
- ✅ `README.md` - Documentación
- ✅ Código fuente (`src/`, `apps/`)
- ✅ Migraciones de Prisma (`prisma/migrations/`)
- ✅ `package.json` y `package-lock.json`
- ✅ `docker-compose.yml` (las contraseñas son de desarrollo local)

### 2. Verificar credenciales en el código

**Revisa que NO haya:**
- Contraseñas reales hardcodeadas
- API keys reales
- Tokens de producción
- URLs de bases de datos de producción

**Los archivos de prueba están bien:**
- `test-api.http` - Solo tiene ejemplos de desarrollo
- `scripts/test-api.js` - Solo tiene credenciales de prueba

## 📝 Pasos para Subir a GitHub

### Paso 1: Verificar estado de Git

```bash
# Ver qué archivos están siendo rastreados
git status

# Verificar que .env NO esté en el staging
git status | grep .env
# No debe aparecer nada
```

### Paso 2: Crear el repositorio en GitHub ⚠️ IMPORTANTE

**⚠️ Este paso DEBE hacerse ANTES de intentar hacer push. Si no existe el repositorio, obtendrás el error "Repository not found".**

1. Ve a https://github.com/new
2. **Nombre del repositorio:** `comercial-electrica` (o el nombre que prefieras)
3. **Descripción:** "Sistema de gestión comercial para ferretería eléctrica con facturación DIAN"
4. **⚠️ NO marques** "Add a README file" (ya tienes uno local)
5. **⚠️ NO marques** "Add .gitignore" (ya tienes uno)
6. **⚠️ NO marques** "Choose a license" (puedes agregarlo después)
7. Elige **Private** o **Public** según prefieras
8. Click en **"Create repository"**

**Después de crear el repositorio, continúa con el Paso 3.**

### Paso 3: Inicializar Git (si no está inicializado)

```bash
# Desde la raíz del proyecto
cd C:\Users\paulk\OneDrive\Escritorio\Proyecto\Comercial-Electrica

# Inicializar git (si no está inicializado)
git init

# Agregar todos los archivos (respetando .gitignore)
git add .

# Verificar qué se va a subir (importante!)
git status

# Hacer el primer commit
git commit -m "Initial commit: Sistema de gestión comercial eléctrica"
```

### Paso 4: Conectar con GitHub

**⚠️ IMPORTANTE:** Asegúrate de haber creado el repositorio en GitHub (Paso 2) antes de continuar.

```bash
# Si ya tienes un remoto configurado, puedes actualizarlo:
git remote set-url origin https://github.com/USERNAME/comercial-electrica.git

# O si no tienes remoto, agrégalo:
git remote add origin https://github.com/USERNAME/comercial-electrica.git

# O si prefieres SSH:
# git remote add origin git@github.com:USERNAME/comercial-electrica.git

# Verificar el remoto
git remote -v

# Subir el código (usa 'master' si estás en esa rama, o 'main' si ya la renombraste)
git push -u origin master
# O si estás en main:
# git push -u origin main
```

**Si obtienes el error "Repository not found":**
- Verifica que el repositorio existe en GitHub
- Verifica que el nombre del repositorio sea exactamente el mismo
- Verifica que tengas permisos para acceder al repositorio

**⚠️ Autenticación requerida:**

Al hacer `git push`, GitHub te pedirá credenciales. Tienes dos opciones:

**Opción A: Token de Acceso Personal (Recomendado)**
1. Ve a GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click en "Generate new token (classic)"
3. Dale un nombre (ej: "Comercial-Electrica")
4. Selecciona el scope `repo` (acceso completo a repositorios)
5. Click en "Generate token"
6. **Copia el token inmediatamente** (solo se muestra una vez)
7. Al hacer push:
   - Usuario: Tu nombre de usuario de GitHub
   - Contraseña: El token que copiaste

**Opción B: GitHub CLI (gh)**
```bash
# Instalar GitHub CLI (si no lo tienes)
# Windows: winget install GitHub.cli

# Autenticarse
gh auth login

# Luego hacer push normalmente
git push -u origin main
```

**Nota:** Si estás en la rama `master` en lugar de `main`, usa:
```bash
git push -u origin master
```

## 🔒 Recomendaciones de Seguridad

### 1. Variables de Entorno

**NUNCA subas:**
- Archivos `.env` con valores reales
- Contraseñas en el código
- API keys reales
- Tokens de producción

**SÍ sube:**
- `env.example` con valores de ejemplo
- Documentación sobre qué variables se necesitan

### 2. Secrets de GitHub (para CI/CD futuro)

Si planeas usar GitHub Actions o despliegues automáticos:
1. Ve a Settings → Secrets and variables → Actions
2. Agrega:
   - `DATABASE_URL` (producción)
   - `JWT_ACCESS_SECRET` (producción)
   - `DIAN_SOFTWARE_ID` (real)
   - `DIAN_SOFTWARE_PIN` (real)

### 3. Licencia

Considera agregar un archivo `LICENSE`:
- **MIT** - Permisivo, permite uso comercial
- **Apache 2.0** - Similar a MIT con protección de patentes
- **GPL-3.0** - Copyleft, requiere código abierto

### 4. Archivos Adicionales Recomendados

#### `.github/workflows/ci.yml` (opcional, para CI/CD)
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run lint -w api
      - run: npm run build -w api
```

#### `CONTRIBUTING.md` (opcional)
Guía para contribuidores si el proyecto será open source.

## 📋 Comandos Útiles de Git

```bash
# Ver qué archivos están siendo rastreados
git status

# Ver qué archivos están ignorados
git status --ignored

# Ver el historial de commits
git log --oneline

# Crear una nueva rama
git checkout -b feature/nueva-funcionalidad

# Ver diferencias antes de commitear
git diff

# Agregar archivos específicos
git add archivo1.ts archivo2.ts

# Deshacer cambios en un archivo (antes de commit)
git restore archivo.ts
```

## ⚠️ Si accidentalmente subiste un archivo sensible

Si subiste `.env` o algún secreto por error:

1. **Elimínalo del historial:**
```bash
git rm --cached .env
git commit -m "Remove .env from repository"
git push
```

2. **Rota las credenciales:**
   - Cambia todas las contraseñas/keys que estaban en el archivo
   - Actualiza las variables de entorno en producción

3. **Usa GitHub Secret Scanning:**
   - GitHub escanea automáticamente secretos en repos públicos
   - Si encuentras alguno, rótalo inmediatamente

## 🎯 Resumen

**✅ Hacer:**
- Verificar `.gitignore` antes de subir
- Usar `env.example` como template
- Documentar variables de entorno necesarias
- Hacer commits descriptivos
- Usar ramas para features nuevas

**❌ NO hacer:**
- Subir archivos `.env` con valores reales
- Hardcodear contraseñas en el código
- Subir `node_modules/` o `dist/`
- Committear tokens o API keys reales

## 📚 Recursos Adicionales

- [GitHub Docs - Ignoring files](https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
