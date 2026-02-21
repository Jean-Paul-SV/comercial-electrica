# Archivos estáticos (public)

Los archivos aquí se sirven en la raíz del sitio.

## Video de fondo del login

Para que la página de login muestre un video de fondo:

1. Añade un archivo **`login-bg.mp4`** en la carpeta **`apps/web/public/video/`** (la URL será `/video/login-bg.mp4`).
2. Recomendado: video corto (10–30 s), en loop, comprimido (< 2–3 MB), MP4 (H.264). Debe estar muteado para que el autoplay funcione en todos los navegadores (el código lo reproduce sin sonido).

Si no añades el archivo, el login seguirá mostrando el fondo de gradientes animados.

**Alternativa:** Puedes usar una URL externa definiendo la variable de entorno `NEXT_PUBLIC_LOGIN_VIDEO_URL` (por ejemplo en Vercel).
