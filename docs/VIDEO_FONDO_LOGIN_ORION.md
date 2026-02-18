# Video de fondo del login (constelación de Orión)

La pantalla de login puede mostrar un video difuminado de fondo. Para usar uno inspirado en la **constelación de Orión**, tienes estas opciones.

## Dónde conseguir el video

### Gratis (descargar y usar en el proyecto)

1. **Pexels**  
   - [Pexels – búsqueda "night sky" / "stars"](https://www.pexels.com/search/videos/night%20sky/)  
   - [Pexels – "starry night"](https://www.pexels.com/search/videos/stars/)  
   - Descargas en HD/4K, licencia libre. Busca “stars”, “constellation”, “night sky”, “milky way”.

2. **Pixabay**  
   - [Pixabay – space / stars](https://pixabay.com/videos/search/space/)  
   - [Pixabay – galaxy / nebula](https://pixabay.com/videos/search/galaxy/)  
   - Vídeos de espacio, estrellas y nebulosas, gratis.

3. **Vimeo**  
   - Ejemplo: [“Constellation Orion glides across the night sky”](https://vimeo.com/79012065)  
   - Revisa la licencia de cada video antes de usarlo.

4. **Coverr / Mixkit**  
   - [Mixkit – nature / sky](https://mixkit.co/free-stock-video/)  
   - Busca “stars”, “sky”, “night”.

### De pago (más específicos de Orión)

- **Science Photo Library**: animación HD de la constelación de Orión (estrellas y nebulosa).  
- **Storyblocks**, **iStock**, **Motion Elements**: buscan “Orion constellation” para clips de constelaciones.

## Formato del video (importante)

**Chrome y Firefox solo reproducen MP4 con códec H.264.** Si tu archivo es MP4 con H.265/HEVC (común en 4K o en exportaciones recientes), no se verá y se usará el video de respaldo.

- **Recomendado:** MP4, códec **H.264**, sin audio o con audio (se reproduce muteado).
- **Evitar:** HEVC/H.265, WebM sin fallback, archivos muy pesados (>20–30 MB pueden tardar o fallar).

### Convertir a H.264 con FFmpeg

Si tienes el video en otro formato o en HEVC, convierte así:

```bash
ffmpeg -i tu-video-original.mp4 -c:v libx264 -profile:v main -c:a aac -movflags +faststart login-bg.mp4
```

- `-movflags +faststart`: deja el metadata al inicio para que empiece a reproducir antes de descargar todo.
- Para reducir tamaño (ej. 720p): añade `-vf "scale=-2:720"` antes del nombre de salida.

Luego coloca el `login-bg.mp4` generado en `apps/web/public/video/login-bg.mp4`.

## Cómo usar tu video en el login

1. Descarga o genera el video (formato H.264; ver sección anterior).
2. Guárdalo en el proyecto como:
   ```
   apps/web/public/video/login-bg.mp4
   ```
3. La app usa por defecto ese archivo; si no existe o falla al cargar (p. ej. formato no soportado), se usa un video de respaldo desde internet.

Recomendación: video corto (10–30 s), en loop, para que funcione bien de fondo difuminado.
