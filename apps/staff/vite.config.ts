import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Console de l'équipe (PNJ / GM). Pas de PWA : elle n'a de sens qu'avec le réseau (P1).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.API_PROXY || 'http://localhost:3000';
  return {
    // La caméra (licence) exige HTTPS sur téléphone : DEV_HTTPS=1.
    plugins: [...(env.DEV_HTTPS === '1' ? [basicSsl()] : []), react()],
    server: {
      host: true,
      port: 5174,
      proxy: {
        '/parties': api,
        '/admin': api,
        '/socket.io': { target: api, ws: true },
      },
    },
  };
});
