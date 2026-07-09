/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Configuração essencial para garantir compatibilidade com o deploy na Cloudflare Pages */
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
