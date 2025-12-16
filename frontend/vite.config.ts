import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/webhook-test': {
        target: 'https://n8n.samtecsolucoes.com.br',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
