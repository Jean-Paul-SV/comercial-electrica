import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    // Si una navegación no está en caché y falla la red, mostrar /offline
    navigateFallback: '/offline',
    runtimeCaching: [
      // 1) JS/CSS estático generado por Next
      {
        urlPattern: /^\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'orion-next-static',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
        },
      },
      // 2) Imágenes y assets estáticos
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'orion-images',
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
        },
      },
      // 3) Fuentes externas (Google Fonts, etc.)
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'orion-fonts',
          expiration: {
            maxEntries: 16,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // 4) Páginas de negocio que queremos que funcionen offline
      {
        urlPattern: ({ request, url }) => {
          if (request.mode !== 'navigate') return false;
          // No cachear panel proveedor ni settings (más sensibles)
          if (url.pathname.startsWith('/provider')) return false;
          if (url.pathname.startsWith('/settings')) return false;

          return (
            url.pathname === '/' ||
            url.pathname === '/app' ||
            url.pathname.startsWith('/sales') ||
            url.pathname.startsWith('/inventory') ||
            url.pathname.startsWith('/cash') ||
            url.pathname.startsWith('/customers')
          );
        },
        handler: 'NetworkFirst',
        options: {
          cacheName: 'orion-pages-critical',
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 5 * 60,
          },
        },
      },
      // 5) Lecturas críticas de la API (ventas, inventario, facturas, clientes)
      {
        urlPattern: new RegExp(
          `^${escapeRegExp(apiBaseUrl)}\\/(sales|inventory|invoices|customers)`,
        ),
        handler: 'NetworkFirst',
        method: 'GET',
        options: {
          cacheName: 'orion-api-critical',
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 5 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // 6) Escrituras a la API: siempre online (sin caché)
      {
        urlPattern: ({ request, url }) => {
          if (request.method === 'GET') return false;
          return url.href.startsWith(apiBaseUrl);
        },
        handler: 'NetworkOnly',
        options: {
          cacheName: 'orion-api-write',
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Reduce bundle: solo importar iconos usados de lucide-react
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default withPWA(nextConfig);
