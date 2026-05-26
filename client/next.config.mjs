/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['phaser'],
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias.phaser3spectorjs = false;

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'commonjs canvas',
      });
    }

    return config;
  },
};

export default nextConfig;
