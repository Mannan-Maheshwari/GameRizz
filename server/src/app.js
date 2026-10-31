import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/environment.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import healthRoutes from './routes/healthRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

export function createApp() {
  const app = express();

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
  }));

  const clientOrigin = new URL(env.CLIENT_ORIGIN);
  const allowedOrigins = [...new Set([
    env.CLIENT_ORIGIN,
    `${clientOrigin.protocol}//localhost:${clientOrigin.port || (clientOrigin.protocol === 'https:' ? '443' : '80')}`,
    `${clientOrigin.protocol}//127.0.0.1:${clientOrigin.port || (clientOrigin.protocol === 'https:' ? '443' : '80')}`
  ])];

  const corsOriginCheck = (origin, callback) => {
    // In development, allow local network IPs (e.g., testing on phone over Wi-Fi)
    if (!origin || env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  };

  // CORS Configuration (NFR-007)
  app.use(cors({
    origin: corsOriginCheck,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
  }));

  // Parsing middleware with bounded body limits
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));
  app.use(cookieParser());

  // General API Rate Limiter (FR-077)
  const apiLimiter = createRateLimiter({
    windowMs: 5000,
    maxRequests: 30,
    message: 'Too many requests sent to the server.'
  });

  // Mount API Routes
  app.use('/api', apiLimiter);
  app.use('/api', healthRoutes);
  app.use('/api', gameRoutes);
  app.use('/api', sessionRoutes);
  app.use('/api', reportRoutes);
  app.use('/api', adminRoutes);

  // Centralized Error Handler (FR-096)
  app.use(errorHandler);

  return app;
}
