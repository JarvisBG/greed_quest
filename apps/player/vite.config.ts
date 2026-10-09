import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.API_PROXY || 'http://localhost:3000';
  return {
    plugins: [
      // Caméra et GPS exigent HTTPS sur téléphone : DEV_HTTPS=1 sert le dev avec un certificat local.
      ...(env.DEV_HTTPS === '1' ? [basicSsl()] : []),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'Greed Quest',
          short_name: 'Greed Quest',
          description: 'Chasse au trésor : balises, cartes et sorts',
          lang: 'fr',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0f1115',
          theme_color: '#0f1115',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          // L'API et le temps réel ne passent jamais par le cache (P1 : le serveur fait foi).
          navigateFallbackDenylist: [/^\/parties/, /^\/admin/, /^\/socket\.io/],
        },
      }),
    ],
    server: {
      host: true,
      proxy: {
        '/parties': api,
        '/admin': api,
        '/socket.io': { target: api, ws: true },
      },
    },
  };
});
