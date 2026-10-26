import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT === "true" ? { output: "export" as const, trailingSlash: true } : { output: "standalone" as const }),
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
