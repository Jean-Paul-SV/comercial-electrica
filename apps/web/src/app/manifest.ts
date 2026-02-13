import type { MetadataRoute } from 'next';

/**
 * Manifest PWA para "Añadir a la pantalla de inicio" y mejor experiencia en móvil.
 * Los iconos 192x192 y 512x512 (PNG) son opcionales; si no existen, el navegador puede usar icon.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Orion – Gestión comercial',
    short_name: 'Orion',
    description: 'Sistema de gestión comercial: ventas, inventario, facturación electrónica.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    scope: '/',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      // Añadir icon-192.png e icon-512.png en public/ para mejor soporte en Android/iOS
    ],
    categories: ['business', 'productivity'],
    lang: 'es',
  };
}
