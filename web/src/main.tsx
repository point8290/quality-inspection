import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { store } from './app/store.ts';
import './index.css';

// Precaches the app shell so the app opens with no network at all. autoUpdate means a new
// build takes over on the next load — a supervisor should never have to think about it.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
