# Guía de configuración DIAN y troubleshooting

> **Fecha:** Febrero 2026  
> **Objetivo:** Configurar variables, certificado y ambientes DIAN; resolver errores típicos.  
> **Complementa:** `DIAN_INTEGRACION_ESTADO.md`, `COMO_PROBAR_INTEGRACION_DIAN.md`.

---

## 1. Variables de entorno

Definir en `.env` (o en el entorno de despliegue). No subir valores reales a repositorio.

| Variable | Obligatorio | Descripción | Ejemplo |
|----------|-------------|-------------|---------|
| `DIAN_ENV` | Sí (para envío real) | `HABILITACION` o `PRODUCCION` | `HABILITACION` |
| `DIAN_SOFTWARE_ID` | Sí (para envío real) | Identificador del software ante la DIAN (NIT del contribuyente) | `900123456-7` |
| `DIAN_SOFTWARE_PIN` | Sí (para envío real) | PIN del software asignado por la DIAN | (valor secreto) |
| `DIAN_CERT_PATH` | Recomendado | Ruta absoluta o relativa al certificado .p12 de firma electrónica | `./certs/firma-electronic.p12` |
| `DIAN_CERT_PASSWORD` | Si hay certificado | Contraseña del archivo .p12 | (valor secreto) |
| `DIAN_RESOLUTION_NUMBER` | Opcional | Número de resolución de facturación | `18764000000001` |
| `DIAN_PREFIX` | Opcional | Prefijo de numeración (ej. FAC, FV) | `FAC` |
| `DIAN_RANGE_FROM` / `DIAN_RANGE_TO` | Opcional | Rango de numeración autorizado | `1` / `1000` |

**Habilitación vs producción**

- **HABILITACION:** Ambiente de pruebas DIAN. No tiene efectos fiscales.
- **PRODUCCION:** Ambiente real. Las facturas enviadas son válidas fiscalmente. Usar solo cuando el software esté habilitado y el certificado vigente.

---

## 2. Certificado de firma (.p12)

1. **Obtener el certificado:** Según el procedimiento de la DIAN y/o el certificador (ej. Certicámara). Debe ser .p12 o .pfx para firma de factura electrónica.
2. **Ubicación:** Colocar el archivo en una ruta a la que la API tenga acceso (ej. `./certs/firma-electronic.p12`). No subir el archivo al repositorio.
3. **Permisos:** El proceso de la API debe poder leer el archivo.
4. **Variables:** `DIAN_CERT_PATH` con la ruta; `DIAN_CERT_PASSWORD` con la contraseña del .p12.
5. **Sin certificado:** Si no se configuran, el XML se genera pero se envía sin firmar (solo válido en desarrollo; la DIAN no aceptará facturas sin firma en producción).

---

## 3. Ambientes (desarrollo, habilitación, producción)

| Ambiente | DIAN_ENV | Uso |
|----------|----------|-----|
| Desarrollo local | No definir o `HABILITACION` | Pruebas sin enviar a DIAN o enviando a habilitación. |
| Staging / QA | `HABILITACION` | Pruebas contra Web Service de habilitación. |
| Producción | `PRODUCCION` | Facturación real. Certificado vigente y software habilitado. |

---

## 4. Troubleshooting

### 4.1 "Error al conectar con DIAN" / timeout

- **Causa:** Red, firewall o URL incorrecta del Web Service.
- **Qué revisar:**
  - Conectividad desde el servidor donde corre la API hacia los dominios DIAN.
  - URLs de habilitación vs producción (consultar documentación oficial DIAN).
  - Timeout del cliente HTTP en `sendToDian()` (aumentar si el servicio DIAN responde lento).

### 4.2 "No autorizado" / 401 al enviar a DIAN

- **Causa:** `DIAN_SOFTWARE_ID` o `DIAN_SOFTWARE_PIN` incorrectos o no configurados.
- **Qué revisar:**
  - Valores en `.env` o variables de entorno del proceso.
  - Que el software esté habilitado ante la DIAN y el PIN corresponda al ambiente (habilitación/producción).

### 4.3 "XML sin firmar" en logs

- **Causa:** No se configuró certificado o la ruta/contraseña son incorrectas.
- **Qué revisar:**
  - `DIAN_CERT_PATH` apunta a un archivo .p12 existente y legible.
  - `DIAN_CERT_PASSWORD` es la correcta para ese .p12.
  - Permisos del archivo en el servidor.

### 4.4 Certificado vencido

- **Causa:** El .p12 ha superado su vigencia.
- **Qué hacer:** Renovar el certificado con el certificador, reemplazar el archivo y actualizar `DIAN_CERT_PATH` (y contraseña si cambia). No usar certificado vencido en producción.

### 4.5 Factura rechazada por la DIAN (validación / esquema)

- **Causa:** XML no cumple esquema UBL 2.1 o reglas del Anexo Técnico (campos obligatorios, CUFE, etc.).
- **Qué revisar:**
  - Mensaje de error devuelto por la DIAN (código y descripción).
  - `generateXML()` en `apps/api/src/dian/dian.service.ts`: estructura UBL, nombres de elementos, rangos de numeración.
  - CUFE calculado según Anexo Técnico si ya está implementado.

### 4.6 Cola de facturación no procesa (BullMQ)

- **Causa:** Redis caído, worker no arrancado o fallos en el job.
- **Qué revisar:**
  - `REDIS_URL` y que Redis esté accesible.
  - Logs del worker (procesador de cola) al intentar enviar a DIAN.
  - Reintentos y dead-letter según configuración de BullMQ.

### 4.7 PDF no se genera o no se guarda

- **Causa:** `generatePDF()` aún en modo placeholder o fallo de disco/storage.
- **Qué revisar:**
  - Implementación de `generatePDF()` en `dian.service.ts` (pdfkit, puppeteer, etc.).
  - Permisos de escritura en la ruta o bucket S3 si se usa storage en la nube.
  - Variable `OBJECT_STORAGE_*` si el PDF se guarda en storage.

---

## 5. Almacenamiento seguro del certificado y contraseña

Para reducir el riesgo de exposición de secretos:

- **Archivo .p12:** Mantenerlo fuera del repositorio y en una ruta con permisos restringidos (solo el usuario que ejecuta la API). En producción, considerar un almacenamiento cifrado o un servicio de secretos que exponga la ruta o el contenido del certificado de forma controlada.
- **Contraseña del certificado:** No commitear `DIAN_CERT_PASSWORD` en `.env` en el repositorio. En producción, usar un **gestor de secretos** (AWS Secrets Manager, HashiCorp Vault, variables secretas del proveedor de despliegue, etc.) e inyectar la contraseña como variable de entorno en tiempo de ejecución. La API lee la contraseña desde `DIAN_CERT_PASSWORD`; el gestor de secretos puede poblar esa variable.
- **Encriptación en reposo:** Si en el futuro la contraseña o el certificado se almacenaran en base de datos, deben cifrarse antes de guardar y descifrarse solo en memoria al usar. Por ahora, al usar solo archivo y variables de entorno, la protección se logra con permisos de archivo y uso de secretos en el despliegue.

---

## 6. Checklist antes de producción DIAN

- [ ] `DIAN_ENV=PRODUCCION`
- [ ] `DIAN_SOFTWARE_ID` y `DIAN_SOFTWARE_PIN` correctos y seguros (secretos)
- [ ] Certificado .p12 vigente; `DIAN_CERT_PATH` y `DIAN_CERT_PASSWORD` configurados
- [ ] Rango de numeración (`DIAN_RANGE_FROM` / `DIAN_RANGE_TO`) coherente con la resolución
- [ ] Envío real a DIAN implementado en `sendToDian()` (no simulado)
- [ ] CUFE calculado según Anexo Técnico e incluido en el XML
- [ ] Pruebas en HABILITACION antes de pasar a PRODUCCION
- [ ] Monitoreo y logs para rechazos DIAN y fallos de cola

---

## 7. Documentos relacionados

| Documento | Contenido |
|-----------|------------|
| `DIAN_INTEGRACION_ESTADO.md` | Estado por componente (XML, firma, envío, PDF, consulta, CUFE). |
| `COMO_PROBAR_INTEGRACION_DIAN.md` | Cómo probar la integración DIAN. |
| `CODIGO_A_QUITAR_AL_USAR_API_FACTURACION.md` | Cambios al usar un proveedor externo de facturación. |
| `env.example` (raíz) | Ejemplo de variables; incluye sección DIAN. |

---

**Última actualización:** Febrero 2026
