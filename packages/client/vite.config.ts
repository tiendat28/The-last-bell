import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  resolve: {
    alias: {
      '@sinh-ton/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});

