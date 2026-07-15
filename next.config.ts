import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async rewrites() {
    return [
      // Hotpage estática servida de public/planeje.html
      // URL bonita /planeje (sem extensão .html)
      { source: "/planeje", destination: "/planeje.html" },
    ];
  },
};

export default nextConfig;
