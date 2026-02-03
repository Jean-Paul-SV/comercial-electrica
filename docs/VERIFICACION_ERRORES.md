# Verificación de errores – Análisis y checklist

## Resumen del análisis

- **API (NestJS):** compila correctamente.
- **Frontend (Next.js):** compila correctamente; solo aviso de versión de `@next/swc` (15.5.7 vs 15.5.11).
- **Linter:** sin errores en `apps/api/src` y `apps/web/src`.

---

## Posible "Internal Server Error" en login

Si al hacer login ves **500 Internal Server Error**, las causas más probables son:

### 1. Base de datos / Prisma

- **Conexión:** `DATABASE_URL` en `.env` debe apuntar a Postgres y el servicio estar levantado (`npm run db:up`).
- **Esquema:** La migración `audit_log_hash_chain` añade `previousHash` y `entryHash` a `AuditLog`. Si la API se levantó antes de aplicar migraciones o el cliente Prisma está desactualizado, las escrituras de auditoría pueden fallar.
- **Qué hacer:**
  1. Con la API **detenida**, en la raíz del proyecto:
     ```bash
     cd apps\api
     npx prisma migrate deploy
     npx prisma generate
     ```
  2. Reiniciar la API (`npm run dev:api` o `npm run dev`).

### 2. Variables de entorno

En la raíz del proyecto, el `.env` (o el que use la API) debe tener al menos:

- `DATABASE_URL` – conexión a Postgres
- `REDIS_URL` – conexión a Redis (ej. `redis://localhost:6379`)
- `JWT_ACCESS_SECRET` – secreto para firmar el JWT (no vacío)

Si falta alguna, la API puede no arrancar o fallar en login. Revisa la consola donde corre la API al iniciar.

### 3. Auditoría ya no debería provocar 500

En `auth.service.ts` todas las llamadas a auditoría en el flujo de login están envueltas en `try/catch`. Si falla el registro de auditoría, se loguea el error pero **el login sigue devolviendo 200** (credenciales válidas) o **401** (credenciales inválidas). Es decir, un fallo de auditoría no debería traducirse en 500.

---

## Cómo localizar el error exacto

1. **Consola de la API**  
   Al reproducir el login, mira la terminal donde corre la API. Los 500 se loguean con stack (véase `AllExceptionsFilter`). Busca líneas que contengan el path `/auth/login` y el status 500.

2. **Respuesta HTTP**  
   Con DevTools → pestaña Network, selecciona la petición a `auth/login` que devuelve 500. En la pestaña "Response" verás el JSON del backend: `message`, `error` y opcionalmente `details`. Ese `message` (y `details` en desarrollo) es lo que usa el backend para describir el error.

3. **Logs de auditoría**  
   Si en consola aparece `Error al registrar audit log:` o `Error al registrar auditoría de login:`, el fallo está en el servicio de auditoría (p. ej. Prisma/cliente desactualizado o BD). Aun así, con los cambios actuales el login ya no debería responder 500 por eso.

---

## Checklist rápido

- [ ] Postgres y Redis levantados (`npm run db:up`).
- [ ] Migraciones aplicadas (`npx prisma migrate deploy` en `apps/api`).
- [ ] Cliente Prisma generado tras las migraciones (`npx prisma generate` en `apps/api`).
- [ ] `.env` con `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`.
- [ ] API en **http://localhost:3000** (o el `PORT` configurado).
- [ ] Frontend en **http://localhost:3001**; variable `NEXT_PUBLIC_API_BASE_URL` = `http://localhost:3000` (o sin definir, que usa ese valor por defecto).

---

## Aviso de build (frontend)

Al compilar el frontend puede aparecer:

```text
Mismatching @next/swc version, detected: 15.5.7 while Next.js is on 15.5.11
```

Es un aviso de versión, no un error. Para alinearlo (opcional):

```bash
cd apps\web
npm install @next/swc@15.5.11 --save-dev
```
