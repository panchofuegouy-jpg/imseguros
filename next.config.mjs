/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // El indicador de desarrollo de Next tapaba «Cerrar sesión» abajo a la izquierda.
  devIndicators: {
    position: 'bottom-right',
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: false, // Desactiva modo strict para evitar renders dobles en dev
  // react-pdf se ejecuta en Node tal cual (no lo empaqueta webpack).
  serverExternalPackages: ['@react-pdf/renderer'],
  // Fuentes y logo del PDF de propuestas: que viajen con la función en el deploy.
  outputFileTracingIncludes: {
    '/api/renewal-proposals': ['./assets/pdf/**'],
  },
  experimental: {
    optimizePackageImports: [
      '@/components',
      '@/lib',
      '@radix-ui',
      'lucide-react',
    ],
  },
}

export default nextConfig
