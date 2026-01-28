import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  API_PORT: z.string().transform(Number).default('3001'),
  API_HOST: z.string().default('0.0.0.0'),
  AGENTS_URL: z.string().default('http://localhost:8000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HUMAN_TIMEOUT_MINUTES: z.string().transform(Number).default('30'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = {
  database: {
    url: parsed.data.DATABASE_URL,
  },
  server: {
    port: parsed.data.API_PORT,
    host: parsed.data.API_HOST,
  },
  agents: {
    url: parsed.data.AGENTS_URL,
  },
  env: parsed.data.NODE_ENV,
  humanTimeoutMinutes: parsed.data.HUMAN_TIMEOUT_MINUTES,
} as const;
