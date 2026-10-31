import { env } from '../config/environment.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  // Do not expose stack traces or raw database messages to users
  const message = (statusCode === 500 && env.NODE_ENV === 'production')
    ? 'An unexpected error occurred. Please try again.'
    : err.message || 'Internal server error';

  if (statusCode === 500) {
    console.error(`[Error] ${req.method} ${req.url} - ${errorCode}:`, err.stack || err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message
    }
  });
}
