import { startApp } from './main.js';

startApp({ root: document.getElementById('app') }).catch((error) => {
  console.error(error);
  const root = document.getElementById('app');
  root.textContent = 'The app couldn’t start. Close it and open it again. If this keeps happening, the tablet may be out of storage.';
  root.className = 'fatal';
});
