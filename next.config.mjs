/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    loader: "custom",
    loaderFile: "./lib/r2/cloudflare-image-loader.ts"
  },
  poweredByHeader: false
};

export default nextConfig;
