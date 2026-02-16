# DIAN – Guía paso a paso (sin tecnicismos)

Esta guía dice **qué hacer en la web de la DIAN** y **qué poner en Orion** para que las facturas se envíen a la DIAN de verdad.

---

## Parte 1: Entender en 3 líneas

1. **La DIAN** es quien recibe las facturas electrónicas. Tiene una “puerta” (un servicio web) donde tu programa envía el XML de la factura.
2. **Tú no compras ninguna API.** Esa “puerta” es gratuita; lo que necesitas es **darte de alta** (registrarte y habilitarte) y que la DIAN te dé un **usuario y contraseña** (Software ID y PIN).
3. **Orion ya está preparado** para enviar el XML por esa puerta. Solo falta que tú obtengas esas credenciales y las pongas en el archivo `.env`.

---

## Parte 2: Qué hacer con los documentos y la caja de herramientas

Tienes ya (o vas a descargar) tres cosas. Aquí qué es cada una y **qué hacer con ella**:

---

### Los dos PDFs (consulta cuando haga falta)

| Documento | Enlace directo | Qué hacer |
|-----------|----------------|-----------|
| **Guía Herramienta para el Consumo de Web Services** | [Guía Web Services (PDF)](https://www.dian.gov.co/impuestos/factura-electronica/Documents/Guia-Herramienta-para-el-Consumo-de-Web-Services.pdf) | **Guárdalo** en una carpeta (ej. `docs/dian/` del proyecto). **Abrirlo** cuando quieras ver cómo se llama la operación de envío, la URL exacta o por qué la DIAN rechazó un envío. No hace falta leerlo de punta a punta; Orion ya envía con la operación ReceiveInvoice. |
| **Anexo Técnico Factura Electrónica de Venta v1.9** | [Anexo técnico 1.9 (PDF)](https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Factura-Electronica-de-Venta-vr-1-9.pdf) | **Guárdalo** igual. **Consultarlo** si la DIAN rechaza el XML (campos obligatorios, formato de fechas, CUFE, etc.). Orion ya genera XML según esta norma; sirve para depurar rechazos. |

**Resumen:** Los PDFs son **documentación de referencia**. No los “instalas” en Orion. Los tienes a mano por si algo falla o quieres revisar cómo debe ser el XML o el servicio.

---

### La Caja de herramientas (zip)

Tienes **Caja-de-herramientas-FE-V19-V2026.zip** (por ejemplo en `C:\Users\paulk\Desktop\`).

**Qué hacer:**

1. **Descomprimir el zip** en una carpeta (ej. `Desktop\Caja-FE-V19`).
2. **Abrir la carpeta** y revisar qué trae: suele incluir:
   - Herramientas para **validar** XML de factura contra las reglas de la DIAN.
   - A veces **XML de ejemplo** o instructivos.
3. **Orion no usa este zip** para funcionar. La caja de herramientas sirve para:
   - **Validar a mano** un XML que Orion genere (si la DIAN lo rechaza y quieres ver el error concreto).
   - Ver **ejemplos de estructura** si quieres comparar con lo que genera Orion.

**Resumen:** El zip es **opcional**. Descomprímelo si quieres usar las herramientas de validación o los ejemplos. No hace falta para que Orion envíe a la DIAN.

---

### Paso 2.1 – Si aún no has descargado los PDFs

1. Abre el navegador y ve a:  
   **https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/**
2. Descarga:
   - **Guía Herramienta para el Consumo de Web Services** (enlace en la página, o usa el [enlace directo al PDF](https://www.dian.gov.co/impuestos/factura-electronica/Documents/Guia-Herramienta-para-el-Consumo-de-Web-Services.pdf)).
   - **Anexo Técnico Factura Electrónica de Venta versión 1.9** ([enlace directo al PDF](https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Factura-Electronica-de-Venta-vr-1-9.pdf)).
3. Guárdalos en una carpeta (ej. `docs/dian/` del proyecto) para consultarlos cuando haga falta.

### Paso 2.2 – Registrarte y habilitarte (obtener credenciales)

Sin este paso no tendrás Software ID ni PIN.

1. En la **misma página** de Documentación Técnica, baja hasta **“Temas relacionados”**.
2. En la columna **“Soy Facturador Electrónico”** haz clic en:
   - **“¿Qué requiero para facturar electrónicamente?”** → para ver requisitos.
   - **“Prepárate: Pasos para ser Facturador Electrónico”** → para el proceso completo.
3. Sigue los pasos que indique la DIAN (registro con NIT, habilitación, etc.). Al final la DIAN te asignará:
   - **Identificador del software (Software ID)** → lo usarás en Orion.
   - **PIN del software (Software PIN)** → lo usarás en Orion.
4. Si la DIAN ofrece **certificado de firma gratuito**, en “Facturación Gratuita DIAN” verás cómo solicitarlo. Ese certificado es el archivo `.p12` que Orion usa para firmar el XML.

**Resumen:** En la web de la DIAN tú solo haces: **descargar la Guía (y opcionalmente el Anexo y Caja de herramientas)** y **completar el proceso de registro/habilitación** para que te den Software ID, PIN y, si aplica, el certificado.

---

## Parte 3: Qué poner en Orion (archivo .env)

Cuando tengas **Software ID**, **PIN** y, si ya lo tienes, la **ruta al certificado .p12** y su **contraseña**, configura Orion así.

### Opción A – Solo pruebas (Orion simula la respuesta DIAN)

No necesitas credenciales reales. En `.env` puedes dejar:

```env
DIAN_ENV=HABILITACION
DIAN_SOFTWARE_ID=CHANGE_ME
DIAN_SOFTWARE_PIN=CHANGE_ME
```

No pongas `DIAN_API_BASE_URL` ni `DIAN_USE_DEFAULT_URL`. Orion seguirá funcionando y “simulará” que la DIAN aceptó la factura (ideal para desarrollar y probar ventas en tu app).

### Opción B – Envío real a la DIAN (habilitación)

Cuando ya tengas **Software ID** y **PIN** de la DIAN:

1. Abre el archivo **`.env`** en la raíz del proyecto (o donde tengas las variables de la API).
2. Pon o ajusta estas líneas (sustituye por tus valores reales):

```env
DIAN_ENV=HABILITACION
DIAN_SOFTWARE_ID=el_identificador_que_te_dio_la_DIAN
DIAN_SOFTWARE_PIN=el_pin_que_te_dio_la_DIAN
DIAN_USE_DEFAULT_URL=true
```

- **DIAN_USE_DEFAULT_URL=true** hace que Orion use solo la URL oficial de la DIAN (habilitación) sin que tengas que escribir la URL a mano.
3. Si ya tienes el certificado `.p12` para firmar:

```env
DIAN_CERT_PATH=ruta/completa/al/archivo.p12
DIAN_CERT_PASSWORD=la_contraseña_del_p12
```

4. Reinicia la API de Orion (por ejemplo `npm run dev` en la carpeta de la API).

### Opción C – Producción (cuando la DIAN te habilite para producción)

Cuando la DIAN te dé luz verde para producción:

```env
DIAN_ENV=PRODUCCION
DIAN_SOFTWARE_ID=tu_software_id_produccion
DIAN_SOFTWARE_PIN=tu_pin_produccion
DIAN_USE_DEFAULT_URL=true
DIAN_CERT_PATH=ruta/al/certificado_produccion.p12
DIAN_CERT_PASSWORD=contraseña_del_certificado
```

---

## Parte 4: Cómo probar en Orion

1. Asegúrate de que la API y Redis estén corriendo (y la cola `dian` activa).
2. Crea una **venta** desde el front (con cliente que tenga documento y al menos un ítem).
3. Orion generará el XML, lo firmará (si configuraste certificado) y:
   - **Si no pusiste `DIAN_USE_DEFAULT_URL` ni `DIAN_API_BASE_URL`:** simulará la respuesta (verás en logs “Simulando respuesta exitosa”).
   - **Si pusiste `DIAN_USE_DEFAULT_URL=true`** (y Software ID/PIN reales): enviará el XML a la DIAN por su servicio web y en los logs verás el intento de envío y la respuesta.

Si algo falla (rechazo, error de conexión), revisa los logs de la API y, si hace falta, la **Guía de Web Services** que descargaste para ver si la DIAN exige algún paso extra (por ejemplo otro tipo de autenticación).

---

## Resumen en 4 pasos

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| 1 | Web DIAN – Documentación Técnica | Descargar **Guía Herramienta para el Consumo de Web Services** (y opcional Anexo 1.9). |
| 2 | Web DIAN – Temas relacionados | Seguir **“Soy Facturador Electrónico”** y completar registro/habilitación para obtener **Software ID** y **PIN**. |
| 3 | Archivo `.env` de Orion | Poner `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN` y `DIAN_USE_DEFAULT_URL=true` (y certificado si lo tienes). |
| 4 | Orion | Crear una venta y revisar logs para ver si el envío a la DIAN fue correcto o si hubo error. |

Si algo no cuadra con lo que ves en la web de la DIAN (por ejemplo otro nombre de operación o parámetros), se puede ajustar el código de Orion según la **Guía de Web Services** y el WSDL del servicio (enlaces en `COMO_EMPEZAR_CON_DIAN.md`).
