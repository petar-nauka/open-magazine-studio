import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Stamped into the bundle at build time; usePaged appends it to /magazine.css
  // so every deploy fetches the new stylesheet (that file has no hashed name and
  // nginx sends no cache rule for it, so browsers may keep an old copy for days).
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
