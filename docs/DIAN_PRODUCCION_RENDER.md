# DIAN en producción (Render)

Guía para que la API desplegada en Render envíe facturas electrónicas a la DIAN (habilitación o producción).

---

## Requisitos previos

- API ya desplegada en Render (ver [DEPLOY_VERCEL_RENDER.md](./DEPLOY_VERCEL_RENDER.md)).
- Credenciales DIAN: **Software ID** y **PIN** (obtenidos en el proceso de habilitación con la DIAN).
- Opcional: certificado de firma electrónica `.p12` y su contraseña (para firmar el XML antes de enviar).

---

## 1. Variables obligatorias en Render

En el panel de Render:

1. Entra en **Dashboard** → tu servicio **comercial-electrica-api** (o el nombre que tenga la API).
2. Menú izquierdo: **Environment** (o **Environment Variables**).
3. Añade o edita estas variables:

| Variable | Valor | Descripción |
|----------|--------|-------------|
| `DIAN_SOFTWARE_ID` | Tu Software ID (UUID) | Ej: `7fc5e88b-0746-4607-a340-4f9b99f241b2` |
| `DIAN_SOFTWARE_PIN` | Tu PIN | El PIN que te asigna la DIAN para el software |
| `DIAN_USE_DEFAULT_URL` | `true` | Usa la URL oficial según `DIAN_ENV` (hab/prod) |

**Importante:** No subas estas variables al repositorio. Configúralas solo en Render (o en tu gestor de secretos).

---

## 2. Entorno: habilitación vs producción

| Variable | Valor | Cuándo usarla |
|----------|--------|----------------|
| `DIAN_ENV` | `HABILITACION` | Pruebas: envía a `https://vpfe-hab.dian.gov.co` |
| `DIAN_ENV` | `PRODUCCION` | Facturación real: envía a `https://vpfe.dian.gov.co` |

Por defecto, si no defines `DIAN_ENV`, el código usa **HABILITACION**. Cuando tengas el visto bueno de la DIAN, cambia a `PRODUCCION` y redepliega.

---

## 3. Certificado .p12 (opcional)

Si tienes certificado de firma electrónica (.p12):

- **En local:** ya lo tienes en una ruta (ej. `./certs/firma-electronic.p12`). En tu `.env` local:
  - `DIAN_CERT_PATH=./certs/firma-electronic.p12`
  - `DIAN_CERT_PASSWORD=tu_password_del_certificado`

- **En producción (Render):**
  1. **Subir el .p12 al servidor:** Render no permite subir archivos arbitrarios por UI. Opciones:
     - **Secret Files:** En el servicio → **Environment** → pestaña **Secret Files**. Añades un archivo (ej. nombre `dian-cert.p12`) y Render lo monta en una ruta del contenedor (te muestra la ruta, ej. `/etc/secrets/dian-cert.p12`). Usa esa ruta en `DIAN_CERT_PATH`.
     - **Build:** Incluir el .p12 en el repo **solo si el repo es privado y el archivo está en .gitignore** y copiarlo en el Dockerfile/build a una ruta fija. No recomendado si el repo es público.
     - **Bucket/almacenamiento:** Descargar el .p12 desde S3/GCS en el arranque de la API y guardarlo en una ruta temporal; entonces `DIAN_CERT_PATH` apunta a esa ruta. Requiere implementación en código.
  2. En **Environment** (variables):
     - `DIAN_CERT_PATH` = ruta donde está el .p12 en el servidor (ej. `/etc/secrets/dian-cert.p12`).
     - `DIAN_CERT_PASSWORD` = contraseña del certificado (usar variable secreta, no dejarla en ningún archivo en el repo).

Si **no** configuras `DIAN_CERT_PATH` y `DIAN_CERT_PASSWORD`, la API envía el XML a la DIAN **sin firma digital**. Según la DIAN puede ser válido solo en habilitación o no; para producción suelen exigir firma.

---

## 4. Resumen de variables DIAN en Render

### Mínimo para envío real (sin certificado)

```
DIAN_SOFTWARE_ID=tu-software-id-uuid
DIAN_SOFTWARE_PIN=tu-pin
DIAN_USE_DEFAULT_URL=true
DIAN_ENV=HABILITACION
```

### Con certificado .p12 (si usas Secret Files)

```
DIAN_SOFTWARE_ID=...
DIAN_SOFTWARE_PIN=...
DIAN_USE_DEFAULT_URL=true
DIAN_ENV=HABILITACION
DIAN_CERT_PATH=/etc/secrets/dian-cert.p12
DIAN_CERT_PASSWORD=contraseña_del_certificado
```

### Opcionales (valores por defecto en código)

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `DIAN_USE_SOAP` | `true` | Envío con sobre SOAP ReceiveInvoice |
| `DIAN_HTTP_TIMEOUT_MS` | 30000 | Timeout en ms del HTTP al servicio DIAN |
| `DIAN_HTTP_MAX_RETRIES` | 3 | Reintentos en caso de fallo de red |
| `DIAN_HTTP_RETRY_DELAY_MS` | 5000 | Pausa entre reintentos (ms) |

Solo define estas si necesitas cambiar el comportamiento.

---

## 5. Aplicar cambios y redeploy

1. Después de añadir o editar variables en **Environment**, guarda.
2. Render suele preguntar si quieres **redeploy**. Elige **Save Changes** y confirma el redeploy para que la API arranque con las nuevas variables.
3. Si no redeployó solo: en la pestaña **Manual Deploy** → **Deploy latest commit**.

---

## 6. Comprobar que está activo

- En los **Logs** del servicio en Render, al arrancar no debería aparecer el aviso:  
  `⚠️ DIAN_SOFTWARE_ID o DIAN_SOFTWARE_PIN no configurados`.
- Desde la app (Vercel o local apuntando a la API de Render), registra una venta que dispare factura electrónica y revisa los logs de la API: deberías ver el envío a la DIAN (y en habilitación la respuesta de la DIAN).

Para más detalle de pruebas y troubleshooting, ver [COMO_EMPEZAR_CON_DIAN.md](./COMO_EMPEZAR_CON_DIAN.md) y [DIAN_GUIA_PASO_A_PASO.md](./DIAN_GUIA_PASO_A_PASO.md).
