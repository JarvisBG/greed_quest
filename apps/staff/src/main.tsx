import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { API_URL } from './lib/client';
import './styles.css';

// Hébergement gratuit : le serveur s'endort après 15 min sans visite. Tant que la console est ouverte, on le garde éveillé.
if (API_URL) setInterval(() => void fetch(`${API_URL}/sante`).catch(() => {}), 10 * 60_000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
