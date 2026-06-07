import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Swallowing benign third-party wallet extension errors about redefining window.ethereum
if (typeof window !== 'undefined') {
  const handleExtensionError = (event: ErrorEvent) => {
    if (
      event.error?.message?.includes('Cannot redefine property: ethereum') || 
      event.message?.includes('Cannot redefine property: ethereum')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  window.addEventListener('error', handleExtensionError, true);
  
  const handleRejection = (event: PromiseRejectionEvent) => {
    if (event.reason?.message?.includes('Cannot redefine property: ethereum')) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  window.addEventListener('unhandledrejection', handleRejection, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
