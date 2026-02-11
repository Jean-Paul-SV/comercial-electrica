# Secretos en producción

Reglas para evitar fugas de credenciales y cumplir buenas prácticas antes de salir a producción.

## Qué no hacer

- **No commitear** archivos `.env` con valores reales (JWT, DIAN, Stripe, DB, Redis). El repo ya ignora `.env`.
- **No loguear** secretos: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DIAN_SOFTWARE_PIN`, `DIAN_CERT_PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, contraseñas de BD, ni el cuerpo de XML firmados con datos sensibles.
- **No exponer** en respuestas de API ni en mensajes de error el contenido de variables de entorno con secretos.

## Qué hacer en producción

- **Gestor de secretos:** Inyectar secretos desde la plataforma (Render → Environment/Secret Files, Vercel → Environment Variables, AWS Secrets Manager, HashiCorp Vault, etc.) en lugar de escribir valores en `.env` en el servidor.
- **Certificados DIAN:** El archivo `.p12` no debe estar en el repositorio. Subirlo al servidor en una ruta segura o leerlo desde un bucket/volumen encriptado y accesible solo por la API.
- **Rotación:** Definir política de rotación para JWT secrets, PIN DIAN y certificado según normativa y mejores prácticas.

## Comprobación rápida

Antes de desplegar, revisar que ningún `logger.log`, `logger.warn`, `logger.error` o `console.log` incluya las variables anteriores ni el contenido de `req.rawBody` (webhooks) más allá de lo necesario para debugging controlado.
