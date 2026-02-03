/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Reduce bundle: solo importar iconos usados de lucide-react
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
