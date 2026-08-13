/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone is for Docker/EC2 only — Vercel uses its own serverless output.
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  // Tell Next.js not to bundle these — they run only on the server
  serverExternalPackages: ['mongoose', 'resend'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'as1.ftcdn.net' },
      { protocol: 'https', hostname: 'ik.imagekit.io' },
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
