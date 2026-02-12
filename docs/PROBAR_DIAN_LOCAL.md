# Probar Facturación electrónica en local

Checklist para levantar API + web y probar **Cuenta → Facturación electrónica** en tu máquina.

---

## 1. Base de datos

- Tu `.env` ya apunta a una BD (p. ej. Render o local).
- **Migraciones:** ya aplicadas (`npx prisma migrate deploy`).
- **Seed:** si la BD está vacía o quieres asegurar plan/tenant/roles, ejecuta desde la raíz del repo:
  ```bash
  npm run prisma:seed
  ```
  (Puede tardar si la BD está en Render.)

---

## 2. Clave para certificados (obligatoria)

En tu **`.env`** (raíz del repo) añade:

```env
DIAN_CERT_ENCRYPTION_KEY=49c3df8d8cee9150a1f62c998d9a4cc0545fd228811e8e2fb33d63ace8bc9db3
```

(Esa es una clave de ejemplo generada; en producción usa una distinta y guárdala en un gestor de secretos.)

---

## 3. Arrancar API y web

Desde la **raíz** del proyecto:

```bash
npm run dev
```

Esto levanta:
- **API** en `http://localhost:3000` (o el PORT de tu .env)
- **Web** en `http://localhost:3001` (o el puerto que use Next)

---

## 4. Usuario con acceso

Si usas la BD local (Docker) y acabas de hacer seed, puedes crear un admin de prueba:

```bash
cd apps/api
# En PowerShell, apuntar a BD local:
$env:DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"
npx ts-node scripts/create-tenant-admin.ts
```

Queda creado el usuario **admin@local.dev** con contraseña **AdminLocal1!** (rol ADMIN, tenant default). Inicia sesión con él para ver **Cuenta → Facturación electrónica**.

- Si no usas el script: entra con cualquier usuario que tenga **rol ADMIN** y **tenant** asignado. El seed asigna tenant y rol a los usuarios existentes; si no tienes ninguno, créalo desde la app o Prisma Studio (ver `docs/CONFIGURAR_FACTURACION_ELECTRONICA_PASOS.md`).

---

## 5. Probar la pantalla

1. Abre la web (ej. `http://localhost:3001`).
2. Inicia sesión.
3. Menú **Cuenta → Facturación electrónica**.
4. Rellena:
   - Datos del emisor (NIT, razón social)
   - Software DIAN (ID, PIN)
   - Sube certificado .p12 + contraseña
   - Numeración y ambiente
5. **Guardar configuración** y **Subir certificado**.
6. Comprueba que el estado pase a **"Listo para facturar"**.

---

## Si usas BD local (Docker)

```bash
npm run db:up
```

Luego en `.env` pon `DATABASE_URL="postgresql://ce:ce_password@localhost:5432/comercial_electrica?schema=public"` y ejecuta migraciones + seed de nuevo.

---

Para probar **todos los cambios recientes** (bloqueos, alertas, auditoría, roles finos, contingencia, panel proveedor, etc.), ver **`docs/COMO_PROBAR_CAMBIOS_RECIENTES.md`**.
