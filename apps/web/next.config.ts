import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig:NextConfig = {
  output:process.env.HARAMBEEONE_STANDALONE === 'true' ? 'standalone' : undefined,
  outputFileTracingRoot:path.join(__dirname,'../..'),
  images:{unoptimized:true},
  poweredByHeader:false,
  reactStrictMode:true,
};

export default nextConfig;
