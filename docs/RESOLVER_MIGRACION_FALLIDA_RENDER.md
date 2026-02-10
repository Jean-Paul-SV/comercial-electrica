# Resolver migración fallida en producción (Render)

Cuando Prisma muestra **P3009** ("migrate found failed migrations"), hay que marcar esa migración antes de poder desplegar de nuevo.

## Qué pasó

La migración `20260206000000_fix_product_dictionary_category_id` falló por un error de sintaxis en el SQL (ya corregido en el repo). En la base de producción quedó registrada como **fallida**, y Prisma no aplica más migraciones hasta resolverla.

## Pasos (una sola vez)

### 1. Marcar la migración como “rolled back”

Así Prisma deja de considerarla fallida y en el próximo deploy volverá a ejecutarla (ya con el SQL corregido).

Desde tu máquina, con la **URL de la base de producción** (la que usa Render) en `DATABASE_URL`:

```bash
cd apps/api
# Usar la misma DATABASE_URL que tiene el servicio en Render (Internal Database URL o la que uses)
npx prisma migrate resolve --rolled-back "20260206000000_fix_product_dictionary_category_id"
```

Puedes copiar `DATABASE_URL` desde Render: servicio → Environment → variable `DATABASE_URL` (o la que apunte a la base de producción).

### 2. Subir el fix y volver a desplegar

- Asegúrate de que el fix del SQL esté en el repo (commit y push).
- En el próximo deploy, `prisma migrate deploy` ejecutará de nuevo esa migración (con el SQL corregido). Los pasos usan `IF NOT EXISTS` / comprobaciones, así que es seguro aunque parte hubiera llegado a aplicarse.

### Si en Render tienes Shell

Si Render te da acceso a un shell del servicio:

1. En ese shell, `cd` al directorio del proyecto.
2. Ejecuta:
   ```bash
   npx prisma migrate resolve --rolled-back "20260206000000_fix_product_dictionary_category_id"
   ```
3. Luego haz un redeploy para que arranque con la migración ya resuelta y el código nuevo.

## Alternativa: marcar como aplicada

Solo si **estás seguro** de que la migración ya se aplicó por completo en la base (por ejemplo, la ejecutaste a mano):

```bash
npx prisma migrate resolve --applied "20260206000000_fix_product_dictionary_category_id"
```

En ese caso no volverá a ejecutarse; usa esta opción solo cuando la base ya esté en el estado que esa migración deja.
