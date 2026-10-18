import { createRoot } from 'react-dom/client';
import { App } from './App';
import { garderEveille } from './lib/api';
import '@gq/ui/styles.css';
import './styles.css';

garderEveille();

// Pas de StrictMode : les cinématiques jouent leurs sons au montage (un double montage les doublerait).
createRoot(document.getElementById('root')!).render(<App />);
