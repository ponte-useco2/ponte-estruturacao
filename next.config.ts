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

      // Proposta pública do HUB Bananeiras. O Workspace reservado NÃO vive em
      // public/ — é servido por Route Handler autenticado em
      // /hub-bananeiras/workspace (ver src/proxy.ts).
      { source: "/hub-bananeiras", destination: "/hub-bananeiras.html" },
    ];
  },
};

export default nextConfig;
