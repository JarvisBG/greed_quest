import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Écran géant (Phase 5) : lecture seule, public. Relaie l'API et le temps réel vers l'API locale en dev.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.API_PROXY || 'http://localhost:3000';
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5175,
      proxy: {
        '/parties': api,
        '/socket.io': { target: api, ws: true },
      },
    },
  };
});
