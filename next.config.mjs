import MillionLint from "@million/lint";
/** @type {import('next').NextConfig} */

const nextConfig = {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
};

export default MillionLint.next({
  enabled: true,
  rsc: true
})(nextConfig);
