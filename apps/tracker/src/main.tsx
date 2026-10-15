import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@gq/ui/styles.css';
import './styles.css';

// Pas de StrictMode : les cinématiques jouent leurs sons au montage (un double montage les doublerait).
createRoot(document.getElementById('root')!).render(<App />);
