# Explicación: Errores de DianProcessor en Tests

## ¿Qué es DianProcessor?

`DianProcessor` es un **worker/procesador de cola** que procesa documentos DIAN de forma **asíncrona** en segundo plano usando **BullMQ**.

## Flujo Normal (Producción)

1. **Usuario crea una venta** → `SalesService.createSale()`
2. **Se crea un documento DIAN** en la base de datos
3. **Se encola un trabajo** en BullMQ para procesar el documento DIAN
4. **DianProcessor** (que corre en segundo plano) toma el trabajo de la cola
5. **Procesa el documento**: genera XML, firma, envía a DIAN, genera PDF
6. **Actualiza el estado** del documento según la respuesta de DIAN

## ¿Por qué aparecen errores en los tests?

Cuando ejecutas los tests E2E:

1. **Los tests crean ventas/cotizaciones** → Se crean documentos DIAN y se encolan trabajos
2. **Los tests terminan** → Se limpia la base de datos (`cleanDatabase()`)
3. **Los documentos DIAN se eliminan** de la base de datos
4. **DianProcessor sigue corriendo** en segundo plano intentando procesar los trabajos encolados
5. **Intenta buscar el documento** → No lo encuentra → Lanza error: `"Documento DIAN ... no encontrado"`

## ¿Son un problema?

**NO**. Estos errores:
- ✅ **No afectan los resultados de los tests** (todos pasan: 42/42)
- ✅ **Ocurren DESPUÉS** de que los tests terminan
- ✅ **Son esperados** en un entorno de testing
- ✅ **No indican un bug** en el código

## Soluciones Posibles

### Opción 1: Silenciar errores en entorno de test (Recomendado)

Modificar `DianProcessor` para que detecte el entorno de test y maneje los errores de forma silenciosa:

```typescript
async process(job: Job<{ dianDocumentId: string }>) {
  const { dianDocumentId } = job.data;
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

  try {
    await this.dianService.processDocument(dianDocumentId);
    // ...
  } catch (error) {
    // En entorno de test, silenciar errores de documentos no encontrados
    if (isTestEnv && error instanceof NotFoundException) {
      this.logger.debug(`[Job ${job.id}] Documento ${dianDocumentId} eliminado por tests - ignorando`);
      return { success: false, skipped: true, reason: 'document_deleted_in_test' };
    }
    throw error;
  }
}
```

### Opción 2: Detener el procesador durante tests

Deshabilitar completamente el procesador DIAN en el entorno de test.

### Opción 3: Limpiar la cola antes de los tests

Limpiar todos los trabajos pendientes en la cola DIAN antes de ejecutar los tests.

## Estado Actual

- ✅ **Todos los tests pasan** (42/42)
- ✅ **Los errores de DIAN son solo ruido** en los logs
- ✅ **No afectan la funcionalidad**

## Recomendación

**Dejar como está** por ahora, ya que:
- Los tests funcionan correctamente
- Los errores son informativos (sabes que el procesador está intentando procesar trabajos eliminados)
- En producción no ocurrirá este problema

Si quieres silenciar estos errores, podemos implementar la **Opción 1** para que solo muestre logs de debug en lugar de errores.
