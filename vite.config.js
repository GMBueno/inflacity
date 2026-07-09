import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em GitHub Pages (project site) o app fica em /inflacity/
// Localmente e em preview sem env: base "/"
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
