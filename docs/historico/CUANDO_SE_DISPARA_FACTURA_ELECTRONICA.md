# Cuándo se dispara la factura electrónica (DIAN)

En Orion la **factura electrónica se genera y se envía a la DIAN de forma automática**; no hay un botón aparte para “emitir factura electrónica”.

---

## Cuándo se dispara

Se dispara **cada vez que se crea una venta** en el sistema:

1. **Registrar una venta**  
   En **Ventas** → “Nueva venta”: eliges cliente, productos, forma de pago y sesión de caja. Al guardar, se crea la venta, la factura interna y el documento DIAN, y se encola el envío a la DIAN.

2. **Convertir cotización en factura**  
   En **Cotizaciones** → “Convertir a factura”: al convertir una cotización en venta (con sesión de caja abierta), se crea la venta y con ella la factura y el documento DIAN; también se encola el envío.

No se dispara al editar una venta ya creada ni desde otros módulos (gastos, compras, etc.); solo en la **creación** de la venta.

---

## Cómo ver que se disparó

### 1. En la interfaz (después de crear la venta)

- Tras guardar la venta, el mensaje de éxito suele mostrar el **número de factura** (ej. “Factura #FAC-00042”).
- Ese número corresponde a la factura interna; el envío a la DIAN ocurre en segundo plano (cola).

### 2. En los logs de la API

Con la API en marcha (local o Render), en los logs verás líneas como:

```
[DianProcessor] [Job 1] Procesando documento DIAN: <uuid>
[DianService] Procesando documento DIAN: <uuid>
[DianService] Generando XML para documento <uuid>
[DianService] Firmando documento <uuid>   (o: Firma digital omitida...)
[DianService] Enviando documento <uuid> a DIAN (ambiente: HABILITACION)
[DianService] Envío DIAN intento 1/3 a https://vpfe-hab.dian.gov.co/...
[DianProcessor] [Job 1] Documento <uuid> procesado exitosamente
[DianProcessor] [Job 1] Completado exitosamente
```

Si el envío falla, verás `WARN` o `ERROR` con el motivo (ej. 415, rechazo de la DIAN, etc.).

### 3. En la base de datos

Cada venta tiene una factura (`Invoice`) y un documento DIAN (`DianDocument`) vinculado. En la tabla `DianDocument` puedes ver:

- `status`: `DRAFT` → al procesar pasa a `ACCEPTED` o `REJECTED` según la respuesta de la DIAN.
- `cufe`, `dianResponse`, etc., si ya los guardas.

---

## Resumen

| Acción en la app              | ¿Dispara factura electrónica? |
|------------------------------|-------------------------------|
| Crear una venta (Ventas)     | Sí                            |
| Convertir cotización a venta | Sí                            |
| Editar venta ya creada       | No                            |
| Anular factura               | No (solo anula internamente)  |

Para comprobar que todo va bien: crea una venta, mira el número de factura en la pantalla y revisa los logs de la API para ver el procesamiento y el envío a la DIAN.
