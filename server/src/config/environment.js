import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(configDir, '../../.env'),
  path.resolve(configDir, '../../../.env')
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/gamerizz'),
  SESSION_SECRET: z.string().min(16).default('development_fallback_secret_min_16_chars_long'),
  ADMIN_JWT_SECRET: z.string().min(16).default('development_admin_jwt_secret_min_16_chars_long'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('admin12345'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(5000),
  RATE_LIMIT_MAX_CHAT: z.coerce.number().default(5),
  RPS_MOVE_TIMEOUT_SECONDS: z.coerce.number().default(20),
  CRICKET_DELIVERY_TIMEOUT_SECONDS: z.coerce.number().default(20),
  RECONNECT_GRACE_PERIOD_SECONDS: z.coerce.number().default(30),
  TICKET_RETENTION_DAYS: z.coerce.number().default(90)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Environment configuration error:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
