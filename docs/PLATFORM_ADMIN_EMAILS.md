# PLATFORM_ADMIN_EMAILS – Panel proveedor fijo

Variable de entorno que define qué correos **siempre** son administradores de Panel proveedor (acceso a Empresas, Planes, etc.) y **nunca** deben estar asociados a un tenant (empresa).

---

## Qué hace

- **Login / getMe:** Esos correos reciben `isPlatformAdmin: true` y la app los redirige a `/provider` aunque en la BD tengan `tenantId` asignado.
- **Registro:** Si el correo está en la lista, el usuario se crea con `tenantId = null`.
- **Invitación a empresa:** No se puede invitar a un correo de la lista (mensaje: *"Este correo está reservado para el Panel proveedor..."*).
- **Crear empresa:** No se puede usar un correo de la lista como admin de la nueva empresa.
- **Seed:** Si está definida, el seed desvincula de tenant a esos usuarios (`User.tenantId = null`, `UserRole.tenantId = null`).

**Formato:** lista separada por comas. Ejemplo:

```env
PLATFORM_ADMIN_EMAILS=jean.serratov@orion.com,otro@ejemplo.com
```

---

## Por qué es lo más óptimo (para un correo fijo)

1. **Una sola configuración:** Una variable de entorno; no hace falta tocar esquema ni migraciones.
2. **Protección en todos los flujos:** Registro, invitación y creación de empresa impiden asociar ese correo a un tenant.
3. **Corrige datos viejos:** Al ejecutar el seed con la variable puesta, se deja otra vez `tenantId = null` si en el pasado quedó asociado.
4. **Sin cambios de modelo:** No se añaden campos ni tablas.

Para **un correo fijo** que debe estar solo en Panel proveedor (ej. `jean.serratov@orion.com`), esta solución es la más simple y óptima.

---

## Cuándo no sería lo óptimo

- **Varios admins de plataforma** o necesidad de **cambiar la lista a menudo** → tendría más sentido un campo en `User` (ej. `isPlatformAdmin`) o un rol en BD.
- **Gestionar desde la app** quién es admin de plataforma (pantalla de configuración) → haría falta ese modelo en BD y una UI/API para mantenerlo.

En esos casos se podría valorar una migración que añada `User.isPlatformAdmin` (o un rol dedicado) y lógica/UI para gestionarlo.

---

## Producción

1. En Render (o donde esté la API): **Environment** → añadir `PLATFORM_ADMIN_EMAILS=jean.serratov@orion.com`.
2. Subir los cambios y desplegar.
3. (Opcional) Ejecutar el seed contra la BD de producción con la variable puesta para dejar `tenantId = null` en esos usuarios:

   ```powershell
   cd apps\api
   $env:PLATFORM_ADMIN_EMAILS = "jean.serratov@orion.com"
   .\scripts\seed-production.ps1
   ```

Ver también: `env.example` (comentario de `PLATFORM_ADMIN_EMAILS`), `docs/PASOS_SUBIR_PRODUCCION.md`.
