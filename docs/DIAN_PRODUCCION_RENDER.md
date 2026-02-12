# DIAN en Render – Qué hacer paso a paso

Guía para configurar la API en Render y que envíe facturas electrónicas a la DIAN (habilitación o producción).

---

## ¿Cuándo tengo el certificado .p12?

- El **certificado de firma electrónica (.p12)** y su **contraseña** te los entregan cuando terminas el proceso con la DIAN / certificador (por ejemplo después de pasar la fase de pruebas con la **Caja de herramientas FE** o el proceso de habilitación).
- **Mientras no tengas el .p12:** puedes configurar en Render todo lo demás (Software ID, PIN, NIT, razón social). La API **no enviará** facturas a la DIAN hasta que añadas el certificado; mostrará un mensaje claro en lugar de hacer reintentos inútiles.
- **Cuando te den el .p12** (archivo + contraseña), sigue el paso 4 más abajo para subirlo a Render en base64.

---

## 1. Entrar a las variables en Render

1. **Dashboard** de Render → tu servicio de la **API** (ej. `comercial-electrica-api`).
2. Menú izquierdo: **Environment**.
3. Ahí añades las variables una a una (Key = nombre, Value = valor). Las sensibles (PIN, contraseña, base64) las marcas como **Secret** para que no se vean en la UI.

---

## 2. Variables que puedes configurar YA (sin certificado)

Añade estas en **Environment**:

| Key | Value | ¿Secret? |
|-----|--------|----------|
| `DIAN_SOFTWARE_ID` | El Software ID (UUID) que te asigna la DIAN | No (o sí si prefieres) |
| `DIAN_SOFTWARE_PIN` | El PIN del software | **Sí** |
| `DIAN_USE_DEFAULT_URL` | `true` | No |
| `DIAN_ENV` | `HABILITACION` (pruebas) o `PRODUCCION` (real) | No |
| `DIAN_ISSUER_NIT` | NIT de tu empresa (ej. `900123456-7`) | No |
| `DIAN_ISSUER_NAME` | Razón social de tu empresa (ej. `Mi Empresa S.A.S.`) | No |

- Con esto la API ya “sabe” a dónde y con qué datos enviar; pero **no enviará** a la DIAN hasta que exista certificado (paso 4).
- Después de guardar, si Render ofrece **redeploy**, acéptalo.

---

## 3. Entorno: habilitación vs producción

| `DIAN_ENV` | Uso |
|------------|-----|
| `HABILITACION` | Pruebas. Envía a `https://vpfe-hab.dian.gov.co`. |
| `PRODUCCION` | Facturación real. Envía a `https://vpfe.dian.gov.co`. |

Usa **HABILITACION** hasta que la DIAN te habilite. Luego cambia a `PRODUCCION` y vuelve a desplegar.

---

## 4. Cuando tengas el certificado .p12 – Opción recomendada en Render (base64)

En Render no hay disco persistente, así que la forma más simple es usar **el contenido del .p12 en base64** en una variable.

1. **En tu PC**, genera el base64 del archivo .p12:
   - **Windows (PowerShell):**  
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("ruta\a\tu\firma.p12"))`
   - **Linux / Mac:**  
     `base64 -w0 firma.p12`  
     (o `base64 -i firma.p12 | tr -d '\n'`)
2. Copia **todo** el texto que salga (una sola línea larga).
3. En Render → **Environment**:
   - **Key:** `DIAN_CERT_BASE64`
   - **Value:** pega ese texto.
   - Marca como **Secret**.
4. Añade la contraseña del .p12 (la que te dieron con el certificado):
   - **Key:** `DIAN_CERT_PASSWORD`
   - **Value:** la contraseña del .p12.
   - Marca como **Secret**.
5. Guarda y **redeploy** del servicio.

A partir de ahí la API firmará el XML y enviará a la DIAN.

---

## 5. Alternativa: archivo .p12 con Secret Files (Render)

Si prefieres no usar base64:

1. En el servicio → **Environment** → pestaña **Secret Files**.
2. Sube el archivo .p12 (ej. nombre `dian-cert.p12`). Render te dará una ruta tipo `/etc/secrets/dian-cert.p12`.
3. En **Environment** (variables normales):
   - `DIAN_CERT_PATH` = esa ruta (ej. `/etc/secrets/dian-cert.p12`).
   - `DIAN_CERT_PASSWORD` = contraseña del .p12 (como **Secret**).

No hace falta `DIAN_CERT_BASE64` si usas `DIAN_CERT_PATH`.

---

## 6. Resumen: listado de variables DIAN en Render

### Sin certificado (solo preparado; no envía a DIAN todavía)

```
DIAN_SOFTWARE_ID=tu-software-id
DIAN_SOFTWARE_PIN=*** (Secret)
DIAN_USE_DEFAULT_URL=true
DIAN_ENV=HABILITACION
DIAN_ISSUER_NIT=900123456-7
DIAN_ISSUER_NAME=Tu Razón Social S.A.S.
```

### Con certificado (envío real) – opción base64

```
... las de arriba ...
DIAN_CERT_BASE64=*** (Secret, contenido .p12 en base64)
DIAN_CERT_PASSWORD=*** (Secret)
```

### Opcionales (solo si necesitas cambiar valores por defecto)

| Variable | Por defecto |
|----------|-------------|
| `DIAN_USE_SOAP` | `true` |
| `DIAN_HTTP_TIMEOUT_MS` | 30000 |
| `DIAN_HTTP_MAX_RETRIES` | 3 |

---

## 7. Aplicar cambios

- Tras añadir o editar variables, **Save** en Environment.
- Si Render pregunta, confirma **redeploy** para que la API arranque con la nueva configuración.
- Si no redeployó solo: **Manual Deploy** → **Deploy latest commit**.

---

## 8. Comprobar

- **Logs** del servicio: no debería aparecer `DIAN_SOFTWARE_ID o DIAN_SOFTWARE_PIN no configurados`.
- Si llamas a la API a **GET /dian/config-status** (con JWT y permiso `dian:manage`), verás `readyForSend: true` cuando no falte nada (incluido certificado).
- Cuando todo esté listo, una venta con factura electrónica debería verse en los logs como envío a la DIAN y respuesta (aceptado/rechazado).

Para más detalle y errores típicos: [GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md](./GUIA_CONFIGURACION_DIAN_Y_TROUBLESHOOTING.md).
