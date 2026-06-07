import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
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