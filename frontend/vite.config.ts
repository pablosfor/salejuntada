import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? 'salejuntada.pablosfor.ar')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts,
    proxy: {
      '/api': {
        target: 'http://backend:4000',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://backend:4000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://backend:4000',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
