import http from 'http';
import { createApp } from './app.js';
import { env } from './config/environment.js';
import { connectDatabase } from './config/database.js';
import { initializeSocketServer } from './sockets/socketServer.js';

async function startServer() {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO
  const io = initializeSocketServer(httpServer);
  app.set('io', io);

  // Listen immediately so the Vite proxy is not refused while MongoDB connects.
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(env.PORT, '127.0.0.1', () => {
      httpServer.removeListener('error', reject);
      console.log(`🚀 Gamerizz Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      console.log(`Allowed Client Origin: ${env.CLIENT_ORIGIN}`);
      resolve();
    });
  });

  // Connect to Database (gracefully handles offline/degraded mode)
  await connectDatabase();

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    httpServer.close(() => {
      console.log('HTTP and WebSocket server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
