# Resolver migración fallida en producción (Render) – Guía paso a paso

Cuando el deploy en Render falla con **P3009** ("migrate found failed migrations"), hay que marcar esa migración en la base de datos de producción **una sola vez**. Luego el siguiente deploy funcionará.

Puedes hacerlo de dos formas. Elige la que prefieras.

---

## Método 1: Desde tu PC (copiando la URL de Render)

### Paso 1: Obtener la URL de la base de datos en Render

1. Abre el navegador y entra en **https://dashboard.render.com**
2. Inicia sesión si hace falta.
3. En la lista de servicios, haz clic en tu **base de datos PostgreSQL** (suele llamarse algo como `comercial_electrica_db` o similar).  
   - Si no la ves en la lista, en el menú izquierdo entra en **Databases** y luego haz clic en esa base de datos.
4. Dentro de la página de la base de datos verás varias pestañas o secciones. Busca **Connect** o **Connection** o **Info**.
5. Busca el texto **Internal Database URL** (o "Internal URL", "Connection string").
6. Haz clic en **Copy** o selecciona toda la URL y cópiala (Ctrl+C).  
   La URL se parece a:  
   `postgresql://comercial_electrica_db_xxxx:unaContraseñaLarga@dpg-d60mku4hg0os73f29u2g-a.oregon-postgres.render.com:5432/comercial_electrica_db`  
   (la tuya será distinta; lo importante es que empiece por `postgresql://`).

### Paso 2: Ejecutar el comando en tu PC

1. Abre **PowerShell** (clic derecho en el escritorio o en la carpeta del proyecto → "Abrir en Terminal" o "Open in Integrated Terminal" si usas VS Code/Cursor).
2. Ve a la carpeta de la API:
   ```powershell
   cd C:\Users\paulk\Desktop\Proyecto\Comercial-Electrica\apps\api
   ```
3. Desactiva un momento el archivo `.env` para que no use la base local:
   ```powershell
   Rename-Item -Path .env -NewName .env.local -ErrorAction SilentlyContinue
   ```
4. Pega la URL que copiaste de Render. **Sustituye** todo lo que está entre comillas por tu URL real (pegando con Ctrl+V):
   ```powershell
   $env:DATABASE_URL = "AQUI_PEGAS_LA_URL_QUE_COPIASTE_DE_RENDER"
   ```
   Ejemplo de cómo debe quedar (con tu URL real):
   ```powershell
   $env:DATABASE_URL = "postgresql://comercial_electrica_db_abc:MiPassword123@dpg-d60mku4hg0os73f29u2g-a.oregon-postgres.render.com:5432/comercial_electrica_db"
   ```
5. Ejecuta el comando que marca la migración como "rolled back":
   ```powershell
   npx prisma migrate resolve --rolled-back "20260206000000_fix_product_dictionary_category_id"
   ```
   Si todo va bien verás un mensaje como: *"Migration 20260206000000_fix_product_dictionary_category_id has been rolled back."*
6. Vuelve a activar tu `.env` local:
   ```powershell
   Rename-Item -Path .env.local -NewName .env -ErrorAction SilentlyContinue
   ```

Listo. Ahora en Render haz un **Manual Deploy** (o espera al siguiente deploy) y el deploy debería completarse.

---

## Método 2: Usar el Shell de Render (sin copiar URL)

Render puede dar un "Shell" conectado a tu servicio, con la base de datos de producción ya configurada.

### Paso 1: Abrir el Shell en Render

1. Entra en **https://dashboard.render.com**
2. Haz clic en tu **Web Service** (el que despliega la API, no la base de datos).
3. Arriba verás varias pestañas: **Logs**, **Metrics**, **Environment**, **Shell**, etc.
4. Haz clic en la pestaña **Shell**.
5. Si te pide "Connect" o "Start Shell", haz clic para abrir la sesión.  
   - Si no ves la pestaña Shell, puede que tu plan no la incluya; en ese caso usa el **Método 1**.

### Paso 2: Ejecutar el comando dentro del Shell

En la ventana del Shell verás una línea en negro donde puedes escribir (prompt). La ruta puede ser algo como `/opt/render/project/src` o similar.

1. Entra en la carpeta de la API (en Render el proyecto suele estar en la raíz del repo):
   ```bash
   cd apps/api
   ```
   Pulsa Enter.
2. Ejecuta:
   ```bash
   npx prisma migrate resolve --rolled-back "20260206000000_fix_product_dictionary_category_id"
   ```
   Pulsa Enter.
3. Si todo va bien verás algo como: *"Migration 20260206000000_fix_product_dictionary_category_id has been rolled back."*

Cierra el Shell si quieres. Luego en Render haz un **Manual Deploy** (o espera al siguiente) y el deploy debería completarse.

---

## Si algo falla

- **"Authentication failed" (P1000):** La URL que usaste no es correcta o la contraseña tiene caracteres raros. Vuelve a copiar la **Internal Database URL** completa desde Render y úsala tal cual en `$env:DATABASE_URL`.
- **"cannot be rolled back because it is not in a failed state" (P3012):** El comando se ejecutó contra tu base **local** (localhost). Asegúrate de haber renombrado `.env` a `.env.local` (Método 1) o de estar en el Shell de **Render** (Método 2).
- **No tengo pestaña Shell:** Usa el Método 1 (desde tu PC con la URL copiada de Render).

---

## Qué hace esto

Prisma guarda en la base de datos qué migraciones se aplicaron y si alguna falló. Esa migración quedó marcada como "fallida". El comando `migrate resolve --rolled-back` le dice a Prisma: "trátala como si no se hubiera aplicado". En el próximo deploy, Prisma volverá a intentar aplicarla; como el SQL ya está corregido en el repo, se aplicará bien y el servicio arrancará.
