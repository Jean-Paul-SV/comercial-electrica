# Pasos para subir a producción

Guía rápida cada vez que quieras desplegar cambios (código o datos como planes) a tu entorno en vivo.

---

## Resumen

| Componente | Dónde | Cómo se actualiza |
|------------|--------|--------------------|
| **Código (API)** | Render | Push a GitHub → Render hace deploy automático |
| **Código (Web)** | Vercel | Push a GitHub → Vercel hace deploy automático |
| **Base de datos (esquema)** | Render PostgreSQL | El API ejecuta `prisma migrate deploy` al arrancar |
| **Datos (planes, permisos, usuario)** | Mismo PostgreSQL | Tú ejecutas el **seed** cuando quieras actualizar planes/permisos |

---

## 1. Subir el código

```bash
# En la raíz del proyecto
git add .
git commit -m "Descripción de los cambios (ej: actualizar planes y precios)"
git push origin main
```

- **Render** (API): si el repo está conectado, hace build y deploy solo. En el `startCommand` ya está `npx prisma migrate deploy`, así que las migraciones se aplican en cada deploy.
- **Vercel** (Web): si el proyecto está conectado al mismo repo, despliega la web automáticamente.

No hace falta hacer nada más en los dashboards para que se actualice el **código**.

---

## 2. Actualizar planes (y otros datos del seed)

Los **planes** (precios, nombres, módulos) viven en la base de datos. Para que en producción se vean los planes nuevos o actualizados, hay que ejecutar el seed contra la base de producción **una vez** (o cada vez que cambies el `seed.ts`).

### Opción A: Script desde tu PC (recomendado)

1. En **Render** → **comercial-electrica-db** → **Connect** → copia la **Internal Database URL** (o External si vas a ejecutar desde tu máquina).
2. En PowerShell, en la raíz del proyecto:

   ```powershell
   cd apps\api
   .\scripts\seed-production.ps1
   ```
3. Cuando pida la URL, pega la de Render y Enter.
4. Verás "Seed completado" cuando termine. Los planes en la web se actualizarán al recargar.

### Opción B: Comandos manuales

```powershell
cd apps\api
$env:DATABASE_URL = "postgresql://usuario:contraseña@host:5432/nombre_db"
npx prisma db seed
```

Usa la **External Database URL** de Render si ejecutas desde tu PC.

### Opción C: Shell de Render

Si tu plan en Render tiene **Shell**:

1. Render Dashboard → **comercial-electrica-api** → **Shell**.
2. En el Shell ya está `DATABASE_URL` de producción. Ejecuta:

   ```bash
   npx prisma db seed
   ```

---

## 3. Comprobar que todo está bien

1. **API:** `https://tu-api.onrender.com/health` → debe responder `"status":"ok"`.
2. **Web:** Abre tu URL de Vercel, inicia sesión y revisa:
   - Panel proveedor → **Planes**: que aparezcan los 5 planes con precios y nombres correctos.
   - Que la app cargue sin errores.

---

## Checklist rápido

- [ ] `git push origin main`
- [ ] Esperar a que Render y Vercel terminen el deploy (ver en los dashboards).
- [ ] Si cambiaste planes en `seed.ts`: ejecutar **seed en producción** (paso 2).
- [ ] Probar login y que los planes se vean bien en la web.

---

## Más detalle

- Despliegue completo y variables de entorno: **`docs/DEPLOY.md`**
- Seed en producción (todas las opciones): **`docs/historico/SEED_EN_PRODUCCION.md`**
- Problemas frecuentes: **`docs/TROUBLESHOOTING.md`**
