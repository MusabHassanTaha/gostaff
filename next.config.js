const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  optimizeFonts: false,
  images: { unoptimized: true },
  output: 'standalone',
  distDir: isDev ? 'next-dev' : '.next',
};

module.exports = nextConfig;
