import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const API_TARGET = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8887';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tabulator': path.resolve(__dirname, './app/lib/tabulator'),
      'punycode': 'punycode/',
    },
  },
  optimizeDeps: {
    include: [
      '@tabulator/react-tabulator/lib/ReactTabulator',
      '@tabulator/react-tabulator/lib/editors/DateEditor',
      '@tabulator/tabulator-tables/dist/js/tabulator',
    ],
    force: true, // Force re-optimization on every start
    esbuildOptions: {
      // Ensure CommonJS modules are properly transformed
      mainFields: ['module', 'main'],
    },
  },
  build: {
    commonjsOptions: {
      include: [/app\/lib\/tabulator/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/attachments': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
