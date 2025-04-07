/** @type {import('next').NextConfig} */
import million from 'million/compiler';

const nextConfig = {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
}

export default million.next(nextConfig);
