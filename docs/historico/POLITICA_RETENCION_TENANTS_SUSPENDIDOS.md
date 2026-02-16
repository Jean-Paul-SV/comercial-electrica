# Política de retención – Datos de tenants suspendidos

> **Objetivo:** Definir cuánto tiempo se conservan los datos de una empresa (tenant) una vez su cuenta está **suspendida** (p. ej. por impago), y qué hacer tras ese plazo.  
> **Referencia:** `SAAS_MODELO_NEGOCIO_Y_OPERACION.md` §7.

---

## 1. Principio

- Al **suspender** un tenant (`isActive: false`), los usuarios de esa empresa **no pueden iniciar sesión**; los **datos no se borran** (productos, ventas, clientes, usuarios, etc. siguen en la base de datos).
- Esta política define **cuánto tiempo** se conservan esos datos y **qué hacer** al final del plazo (archivar, eliminar o mantener según criterio).

---

## 2. Plazo de retención recomendado

| Situación | Plazo recomendado | Notas |
|-----------|-------------------|--------|
| **Tenant suspendido** (cuenta inactiva por impago o baja solicitada) | **12 meses** | Tiempo para que el cliente regularice o solicite exportación. Tras 12 meses sin reactivación, se puede proceder a archivado o baja definitiva según apartado 3. |

- El plazo puede ajustarse por contrato (ej. 6 meses, 24 meses). Debe quedar reflejado en **términos de servicio** o anexo con el cliente.
- Variable de referencia (opcional): `TENANT_SUSPENDED_RETENTION_DAYS=365` en documentación o `.env.example`; la aplicación **no** borra datos automáticamente; la política se aplica con procesos o jobs documentados.

---

## 3. Acciones al final del plazo

Una vez cumplido el plazo de retención para un tenant que sigue suspendido, se puede:

| Opción | Descripción |
|--------|-------------|
| **Archivar** | Export de los datos del tenant (backup por tenant, export a CSV/JSON o copia de BD filtrada) a almacenamiento de largo plazo (S3, Blob) con checksum. Luego se puede eliminar o anonimizar en la BD operativa para liberar espacio. |
| **Eliminar** | Borrado de los datos del tenant (teniendo backup previo). Solo si está permitido por términos y normativa; documentar el proceso y hacer backup antes. |
| **Mantener** | Si no se quiere automatizar, mantener los datos y revisar caso a caso (p. ej. cada año). |

La aplicación **no** incluye hoy un job automático que borre o archive por fecha de suspensión; la ejecución es **manual** o mediante **scripts/jobs propios** (p. ej. listar tenants con `isActive: false` y `updatedAt` o fecha de suspensión anterior a X meses, luego ejecutar export y/o borrado según procedimiento interno).

---

## 4. Recomendaciones

- **Comunicar al cliente** antes de suspender: aviso de impago o de baja, y plazo para solicitar exportación de datos (ej. 30 días).
- **Documentar** en términos de servicio: “Los datos de cuentas suspendidas se conservan X meses; tras ese plazo pueden ser archivados o eliminados.”
- **Backup previo:** Antes de cualquier eliminación o archivado definitivo, asegurar un backup del tenant (por ejemplo usando el mecanismo de backups por tenant si existe, o export desde BD).

---

## 5. Resumen

- **Suspensión:** no borra datos; solo impide acceso.
- **Retención recomendada:** 12 meses para tenants suspendidos (configurable).
- **Al final del plazo:** archivar (export + almacenamiento largo plazo) y/o eliminar con backup previo; proceso manual o con jobs documentados.
- **Legal/comercial:** reflejar el plazo y las acciones en términos de servicio y comunicar al cliente al suspender.
