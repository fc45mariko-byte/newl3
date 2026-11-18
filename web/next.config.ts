import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['pg', 'mammoth', 'unpdf', 'bcryptjs'],
  experimental: { serverActions: { bodySizeLimit: '30mb' } },
};
export default config;
