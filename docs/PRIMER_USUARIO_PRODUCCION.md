# Primer usuario en producción

El proyecto **no incluye base de datos** en el repositorio. En producción debes crear la BD, aplicar el esquema y luego crear el **primer usuario administrador** manualmente.

---

## Orden de pasos (primera vez)

1. **Crear la base de datos** en tu proveedor (Render, Railway, Neon, etc.) y configurar `DATABASE_URL` en las variables de entorno de producción.

2. **Aplicar migraciones** (crea tablas vacías):
   ```bash
   npm run prisma:migrate -w api
   ```
   O en tu pipeline de deploy, el equivalente según tu entorno.

3. **Ejecutar el seed** (crea tenant por defecto, plan, roles y permisos; **no** crea usuarios):
   ```bash
   npm run prisma:seed -w api
   ```

4. **Crear el primer usuario administrador** con un solo request a la API (solo funciona si aún no hay ningún usuario en la BD):
   ```bash
   curl -X POST https://TU-API-PRODUCCION/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{"email":"tu-email@ejemplo.com","password":"TuPasswordSeguro123!"}'
   ```
   - Sustituye `https://TU-API-PRODUCCION` por la URL real de tu API.
   - Usa un email y contraseña segura (mínimo 8 caracteres).
   - Ese usuario quedará como **administrador del tenant por defecto** (“Negocio principal”) y podrá hacer login en la web.

5. A partir de ahí, **entra en la app** con ese email y contraseña. No hace falta volver a ejecutar seed ni bootstrap.

---

## Detalle técnico

- **`POST /auth/bootstrap-admin`** solo funciona si `User.count() === 0`. Si ya existe algún usuario, responde 400 con *"Bootstrap ya fue realizado"*.
- El usuario creado se asigna al **tenant por defecto** (slug `default`) y al **rol admin**, así que puede usar toda la aplicación y el panel de proveedor si aplica.
- Si olvidas ejecutar el seed antes del bootstrap, la API responderá con un error indicando que debes ejecutar primero: `npm run prisma:seed -w api`.

---

## Resumen rápido

| Paso | Acción |
|------|--------|
| 1 | Crear BD y configurar `DATABASE_URL` |
| 2 | `npm run prisma:migrate -w api` |
| 3 | `npm run prisma:seed -w api` |
| 4 | `POST /auth/bootstrap-admin` con tu email y contraseña |
| 5 | Iniciar sesión en la web con esas credenciales |
