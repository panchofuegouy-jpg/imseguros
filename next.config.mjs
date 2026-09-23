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
