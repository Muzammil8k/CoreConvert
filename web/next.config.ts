import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This disables Turbopack for the build process
  experimental: {
    // @ts-ignore - Some versions of NextConfig types are strict about experimental flags
    turbopack: false,
  },
  async headers() {
    return [
      {
        // Apply COOP/COEP to all routes including static /ffmpeg/ files
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',  value: 'same-origin'  },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin'  },
        ],
      },
    ];
  },
  webpack(config: import('webpack').Configuration) {
    config.module = config.module ?? {};
    config.module.noParse = [
      /@ffmpeg\/ffmpeg\/dist\/esm\/worker\.js/,
    ];
    return config;
  },
};

export default nextConfig;