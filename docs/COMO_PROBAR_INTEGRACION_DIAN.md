# Cómo probar la integración con la API DIAN

> Cuando implementes el envío real a la DIAN, puedes hacer pruebas de tres formas: **ambiente de habilitación** (DIAN real en modo prueba), **tests unitarios con mocks** y **tests de integración** opcionales.

---

## 1. Ambiente de habilitación (pruebas reales contra la DIAN)

La DIAN tiene un **ambiente de habilitación** (pruebas) distinto al de **producción**. Las facturas enviadas en habilitación **no** tienen validez tributaria real; sirven solo para validar tu software.

### 1.1 Obtener credenciales de prueba

1. **Registro en la DIAN**  
   - Entra a [www.dian.gov.co](https://www.dian.gov.co) → Facturación electrónica → **Habilitación**.  
   - Sigue el instructivo: [Instructivo de Registro y Habilitación](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/instructivo-de-registro-y-habilitacion-en-factura-electronica/).  
   - Obtendrás (entre otros) un **softwareId** y **softwarePin** para el ambiente de habilitación.

2. **Certificado de firma (pruebas)**  
   - En habilitación puedes solicitar un certificado de prueba (por ejemplo “Facturación Gratuita DIAN” u otro mecanismo que indique la DIAN).  
   - Sin certificado, tu código puede enviar XML sin firmar solo para probar conectividad; la DIAN puede rechazarlo según normativa. Para pruebas completas conviene usar el certificado de habilitación.

3. **Numeración de prueba**  
   - En habilitación sueles usar rangos de numeración autorizados para pruebas (la documentación técnica DIAN indica el formato y rangos de prueba).

### 1.2 Configurar tu app para habilitación

En tu **`.env`** (nunca subas este archivo a Git):

```env
# Ambiente DIAN: solo habilitación para pruebas
DIAN_ENV=HABILITACION

# Credenciales que te dio la DIAN para habilitación
DIAN_SOFTWARE_ID=tu_software_id_habilitacion
DIAN_SOFTWARE_PIN=tu_software_pin_habilitacion

# Certificado de firma (ruta al .p12 de prueba)
DIAN_CERT_PATH=./certs/certificado_habilitacion.p12
DIAN_CERT_PASSWORD=contraseña_del_certificado
```

- **URLs de la API DIAN**  
  En tu código de `sendToDian()` (o cliente HTTP) debes usar las **URLs del ambiente de habilitación** que publique la DIAN en su documentación técnica (suelen ser distintas a las de producción). Ejemplo típico:  
  - Habilitación: `https://vpfe-hab.dian.gov.co/` (o la URL vigente en la documentación).  
  - Producción: `https://vpfe.dian.gov.co/` (o la URL vigente).

Comprueba siempre la [documentación técnica actual](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/).

### 1.3 Flujo de prueba manual

1. Levantar API + frontend + Redis (la cola `dian` debe estar activa).  
2. Asegurarte de que `DIAN_ENV=HABILITACION` y las variables anteriores estén configuradas.  
3. En el frontend: crear una **venta** (o convertir una cotización) para que se genere una factura y se encole el documento DIAN.  
4. Revisar logs de la API: el worker debería procesar el job, llamar a `sendToDian()` y recibir la respuesta de la DIAN.  
5. Revisar en BD: el `DianDocument` debería pasar a `ACCEPTED` o `REJECTED` según la respuesta, y podrías tener CUFE/PDF si ya los implementas.  
6. Opcional: consultar en el portal de la DIAN (habilitación) si el documento aparece.

Así validas **envío real**, **respuesta** y **estado** sin tocar producción.

---

## 2. Tests unitarios (sin llamar a la DIAN)

En los tests **no** debes llamar a la API real de la DIAN (evitas dependencia de red, credenciales y cuotas). Para eso se **mockea** el cliente HTTP o el método que envía a la DIAN.

### 2.1 Mockear el envío en el servicio DIAN

Ejemplo con Jest: reemplazar la llamada HTTP (o `sendToDian`) por una implementación falsa que devuelva una respuesta controlada.

```typescript
// En dian.service.spec.ts (o donde pruebes el flujo)
jest.spyOn(service as any, 'sendToDian').mockResolvedValue({
  success: true,
  cufe: 'CUFE-TEST-123',
  qrCode: 'QR-TEST',
  message: 'Documento aceptado',
  timestamp: new Date().toISOString(),
});
```

Así pruebas: generación de XML, firma (si aplica), actualización de estado en BD y manejo de la “respuesta” sin tocar la DIAN.

### 2.2 Mockear el cliente HTTP (recomendado cuando implementes sendToDian real)

Cuando `sendToDian()` use un cliente HTTP (por ejemplo `axios` o `fetch`):

- En **tests**: inyectar un cliente mock que devuelva `{ success: true }` o `{ success: false, message: '...' }`.  
- Así pruebas el flujo completo del servicio (XML, firma, envío simulado, actualización de `DianDocument` y de la factura).

Tu código ya tiene en `dian.service.spec.ts` mocks de `sendToDian`; cuando implementes el envío real, mantén esos mocks en los tests unitarios y no uses credenciales reales en Jest.

---

## 3. Tests de integración (opcional)

Si quieres un test que **sí** llame a la DIAN en habilitación (por ejemplo en CI una vez al día o bajo demanda):

- Crear un test marcado como **integración** (por ejemplo `*.integration-spec.ts`) que:  
  - Lea `DIAN_ENV`, `DIAN_SOFTWARE_ID`, `DIAN_SOFTWARE_PIN` de env (solo en habilitación).  
  - Cree una factura de prueba en tu BD y ejecute el flujo de envío.  
  - Compruebe que la respuesta sea 200 y que el documento quede en estado esperado (o que el rechazo sea el esperado).  
- Ejecutar ese test solo cuando las credenciales de habilitación estén configuradas (por ejemplo `npm run test:integration`) y **no** en cada commit, para no depender de la disponibilidad de la DIAN ni quemar cuotas.

---

## 4. Resumen rápido

| Tipo de prueba | Objetivo | Cómo |
|----------------|----------|------|
| **Habilitación (manual)** | Probar envío real contra la DIAN sin afectar producción | `DIAN_ENV=HABILITACION` + credenciales y certificado de habilitación; crear venta y revisar logs/BD. |
| **Unitarios** | Validar lógica sin red ni DIAN | Mockear `sendToDian()` o el cliente HTTP en Jest. |
| **Integración (opcional)** | Validar flujo completo contra DIAN habilitación | Test que use credenciales de habilitación y compruebe respuesta/estado; ejecutar bajo demanda. |

Mientras implementas el envío real, mantén **siempre** `DIAN_ENV=HABILITACION` y las URLs de habilitación en tu código hasta que hayas validado todo; solo entonces cambia a **producción** y credenciales/productivas.

---

**Referencias**

- [Documentación técnica DIAN](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/)  
- [Instructivo registro y habilitación](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/instructivo-de-registro-y-habilitacion-en-factura-electronica/)  
- Estado de tu integración: `docs/DIAN_INTEGRACION_ESTADO.md`

**Última actualización:** Febrero 2026
