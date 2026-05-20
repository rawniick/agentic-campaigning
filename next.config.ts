import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native bindings duerfen nicht in den Bundle wandern — sie laufen
  // ausschliesslich in der Node-Runtime der Server-Actions / Route Handlers.
  serverExternalPackages: ["@resvg/resvg-js", "pg", "satori"],
};

export default nextConfig;
