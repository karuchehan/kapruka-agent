import type { NextConfig } from "next";

const config: NextConfig = {
  // Include directives/ in the Vercel serverless function bundle
  outputFileTracingIncludes: {
    "/api/chat": ["./directives/**"],
  },
};

export default config;
