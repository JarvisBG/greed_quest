import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Page d'accueil vitrine (partenaires) : statique, sans API.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5176 },
});
