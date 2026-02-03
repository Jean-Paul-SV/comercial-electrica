# Política de retención – Auditoría (AuditLog)

> **Referencia:** `AUDITORIA_Y_TRAZABILIDAD.md` (estructura de logs, consideraciones legales, §5.3 Retención y archivado).

---

## 1. Plazos de retención

| Tipo de eventos | Retención mínima | Motivo |
|-----------------|------------------|--------|
| **Fiscales / críticos** (category `fiscal`, severity `critical`) | **5 años** en línea o archivados | Normativa tributaria colombiana / DIAN; trazabilidad de ventas, facturas, caja, documentos DIAN. |
| **Resto** (security, operational, admin, etc.) | **Configurable** (recomendado 2 años en línea) | Control interno; reducir tamaño de tabla operativa. |

- **En línea:** registros en la tabla `AuditLog` consultables desde la aplicación.
- **Archivado:** export a CSV/JSON o a almacenamiento inmutable (S3/Blob) con checksum; luego se puede eliminar de la tabla operativa (solo eventos no fiscales y tras el plazo fiscal si aplica).

---

## 2. Variable de entorno (opcional)

| Variable | Descripción | Uso |
|----------|-------------|-----|
| `AUDIT_RETENTION_DAYS` | Días que se conservan en línea los eventos **no fiscales** antes de poder archivarlos o purgarlos. | Solo referencia para scripts o jobs de archivado; la API **no** borra registros automáticamente. Ej.: `730` = 2 años. |

- **Eventos fiscales:** no deben eliminarse antes de 5 años (1 825 días). Si se implementa purga/archivado automático, excluir siempre `category = 'fiscal'` y `severity = 'critical'`.
- Si no se define `AUDIT_RETENTION_DAYS`, no hay valor por defecto de purga; la política se aplica de forma manual o con scripts propios.

---

## 3. Archivado recomendado

1. **Export periódico** (ej. mensual) de registros antiguos a CSV/JSON o a un bucket S3 con versión y sin borrado.
2. **Conservar checksum** del archivo para integridad.
3. **No borrar** desde la aplicación sin proceso documentado y respaldo; si se borra, solo eventos no fiscales y tras cumplir el plazo configurado.

---

## 4. Resumen

- **Fiscal/crítico:** 5 años en línea o archivados; no purgar antes.
- **Resto:** retención configurable (ej. 2 años); `AUDIT_RETENTION_DAYS` como referencia para archivado/purga externa.
- **Documento de diseño completo:** `AUDITORIA_Y_TRAZABILIDAD.md`.
