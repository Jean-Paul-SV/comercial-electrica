# Pasos para levantar todo el programa

Todos los comandos se ejecutan desde la **raíz del proyecto**:
`C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica`

---

## Levantar todo (uso diario)

Cuando ya tienes base de datos, `.env` y dependencias instaladas:

| # | Paso | Comando |
|---|------|---------|
| 1 | Abrir Docker Desktop | (esperar a que esté en marcha) |
| 2 | Levantar Postgres y Redis | `npm run db:up` |
| 3 | Levantar API + Frontend | `npm run dev` |

**URLs:**
- **Frontend:** http://localhost:3001  
- **API:** http://localhost:3000  
- **Swagger:** http://localhost:3000/api/docs  

**Credenciales:** `admin@example.com` / `Admin123!`

---

## Errores `net::ERR_CONNECTION_REFUSED` o 500 en la consola

Si en la consola del navegador ves **ERR_CONNECTION_REFUSED** en peticiones a `http://localhost:3000` (por ejemplo `/cash/sessions`, `/reports/cash`, `/expenses`), significa que **la API no está corriendo** o no es accesible en el puerto 3000.

**Qué hacer:**

1. Asegúrate de tener **Docker** en marcha si usas Postgres/Redis con `npm run db:up`.
2. En una terminal, desde la raíz del proyecto, ejecuta:
   ```powershell
   npm run dev
   ```
   (o `npm run dev:api` en una terminal y `npm run dev:web` en otra).
3. Comprueba que la API arranca sin errores y que en la consola aparece algo como “Nest application successfully started” o que escucha en el puerto 3000.
4. Recarga la página en el navegador (F5).

Si también aparece un **500** al ir a una ruta como `/cash/movements`, suele ser un efecto de tener la API caída: al cargar la ruta, el frontend intenta datos y algo falla. **Con la API levantada**, ese 500 suele desaparecer. Si persiste con la API en marcha, revisa los logs de la terminal de la API para ver el error exacto.

---

## Error "EADDRINUSE: address already in use :::3000"

Si la API no arranca y en consola ves **puerto 3000 en uso**, hay que liberarlo o usar otro puerto.

**Opción A – Liberar el puerto 3000 (Windows):**

1. Ver qué proceso usa el puerto:
   ```powershell
   netstat -ano | findstr :3000
   ```
   La última columna es el **PID** (ej. 25764).

2. Cerrar ese proceso:
   ```powershell
   taskkill /PID 25764 /F
   ```
   (Sustituye `25764` por el PID que te salió.)

3. Volver a levantar: `npm run dev`.

**Opción B – Usar otro puerto para la API:**

1. En la raíz del proyecto, en el `.env`, define:
   ```
   PORT=3002
   ```
2. En el frontend (o en `.env` del proyecto) define que la API está en 3002:
   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3002
   ```
3. Levantar de nuevo: `npm run dev`. La API quedará en **http://localhost:3002** y el frontend en **http://localhost:3001**.

---

## Si `npm run dev` falla: levantar API y Front por separado

En **una terminal**:
```powershell
cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica
npm run dev:api
```

En **otra terminal**:
```powershell
cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica
npm run dev:web
```

---

## Primera vez (desde cero)

Si es la primera vez o no tienes base de datos ni usuarios:

| # | Paso | Comando |
|---|------|---------|
| 1 | Ir a la raíz del proyecto | `cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica` |
| 2 | Crear archivo de entorno | `copy env.example .env` |
| 3 | Instalar dependencias | `npm install` |
| 4 | Levantar Postgres y Redis (Docker) | `npm run db:up` |
| 5 | Generar Prisma y crear tablas | `npm run prisma:generate` y `npm run prisma:migrate` |
| 6 | Crear usuarios (admin + vendedor) | `npm run db:seed` |
| 7 | Crear roles y permisos | `npm run prisma:seed` |
| 8 | Levantar API + Frontend | `npm run dev` |

(Opcional) Poblar con 100 productos/clientes/ventas, etc.:
```powershell
npm run db:seed:100
npm run prisma:seed
```

---

## Resumen rápido (uso diario)

```powershell
cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica
npm run db:up
npm run dev
```

Luego abre **http://localhost:3001** e inicia sesión con `admin@example.com` / `Admin123!`.
