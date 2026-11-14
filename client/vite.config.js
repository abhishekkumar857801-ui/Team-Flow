import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api, /uploads and /socket.io are proxied to the Express server,
// so the browser only ever talks to one origin.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://localhost:4000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': target,
        '/uploads': target,
        '/socket.io': { target, ws: true },
      },
    },
  };
});
