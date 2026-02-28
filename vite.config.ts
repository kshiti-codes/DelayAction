import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      axios: path.resolve(__dirname, 'src/shims/axios.ts'),
      recharts: path.resolve(__dirname, 'src/shims/recharts.ts'),
      clsx: path.resolve(__dirname, 'src/shims/clsx.ts'),
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/lh-api': {
        target: 'https://api.lufthansa.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lh-api/, ''),
      },
    }
  }
});