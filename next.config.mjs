/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath: '/eduwills',
  assetPrefix: '/eduwills/',
  images: { unoptimized: true },
};

export default nextConfig;
