import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig:NextConfig = {
  output:process.env.HARAMBEEONE_STANDALONE === 'true' ? 'standalone' : undefined,
  outputFileTracingRoot:path.join(__dirname,'../..'),
  images:{unoptimized:true},
  poweredByHeader:false,
  reactStrictMode:true,
  async headers() {
    const popupHeader = {
      key:'Cross-Origin-Opener-Policy',
      value:'same-origin-allow-popups',
    };
    return [
      {source:'/login',headers:[popupHeader]},
      {source:'/signup',headers:[popupHeader]},
    ];
  },
};

export default nextConfig;
