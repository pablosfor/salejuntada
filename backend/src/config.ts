import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@db:5432/salejuntada',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/auth/google/callback'
};
