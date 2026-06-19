// En développement : connecté à localhost
// En production : remplace cette URL par celle de ton backend Render
window.BACKEND_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://new-ryoq.onrender.com'; // ← change ici après déploiement
