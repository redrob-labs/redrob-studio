import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // COMFYUI_URL is server-only (see .env.example). Do not inject it into the client bundle.
};

export default nextConfig;
