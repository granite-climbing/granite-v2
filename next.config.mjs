/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./lib/r2/cloudflare-image-loader.ts"
  },
  poweredByHeader: false
};

export default nextConfig;
