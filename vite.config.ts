import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are linked relatively, making it compatible with GitHub Pages subpaths
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});