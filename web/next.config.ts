import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly acknowledge Turbopack (Next.js 16 default).
  // The noParse webpack rule is not needed under Turbopack because
  // Turbopack does not intercept dynamic imports the same way webpack does.
  turbopack: {},

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',  value: 'same-origin'   },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'  },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin'  },
        ],
      },
    ];
  },

  // Webpack config kept for local --webpack dev mode only.
  // Vercel uses Turbopack and ignores this block.
  webpack(config: import('webpack').Configuration) {
    config.module = config.module ?? {};
    config.module.noParse = [
      /@ffmpeg\/ffmpeg\/dist\/esm\/worker\.js/,
    ];
    return config;
  },
};

export default nextConfig;