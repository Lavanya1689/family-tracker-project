/** @type {import('next').NextConfig} */
const nextConfig = {
  // googleapis pulls in google-gax/protobuf code that breaks when webpack
  // bundles it for route handlers (BigInt shim gets mangled) — run these
  // as plain Node requires instead.
  serverExternalPackages: ["googleapis", "google-auth-library", "node-ical"],
};

export default nextConfig;
