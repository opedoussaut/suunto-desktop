import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localProviderApi } from './dev-api';

export default defineConfig({
  plugins: [react(), localProviderApi()],
  clearScreen: false,
  server: {
    strictPort: true,
    host: '127.0.0.1',
    port: 1420,
  },
});
