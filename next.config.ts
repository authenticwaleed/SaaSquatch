import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio"],
  // A stray lockfile above this directory makes Next infer the wrong workspace
  // root, which breaks file tracing on deploy. Pin it to the project.
  outputFileTracingRoot: path.join(__dirname),
  // Standalone output is only for the container image. Netlify's Next.js Runtime
  // expects the default output and breaks if it finds a standalone build, so this
  // stays opt-in rather than always-on.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
};

export default nextConfig;
