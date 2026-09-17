import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio"],
  // A stray lockfile above this directory makes Next infer the wrong workspace
  // root, which breaks file tracing on deploy. Pin it to the project.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
