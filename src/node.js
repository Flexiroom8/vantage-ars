import { initializeFileStore } from './store.js';
import { server } from './server.js';

const port = Number(process.env.PORT) || 3000;

initializeFileStore();

server.listen(port, '0.0.0.0', () => {
  console.log(`Vantage-ARS server listening on http://0.0.0.0:${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});