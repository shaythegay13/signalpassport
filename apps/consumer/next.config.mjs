import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  devIndicators: false,
  outputFileTracingRoot: rootDir,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@signal-passport/schema": path.resolve(rootDir, "packages/schema/src/index.ts"),
      "@signal-passport/verification": path.resolve(rootDir, "packages/verification/src/index.ts")
    };

    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"]
    };

    return config;
  }
};

export default nextConfig;
