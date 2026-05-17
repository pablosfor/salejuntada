import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { configurePassport } from './auth.js';
import { ChatService } from './services/ChatService.js';
import { buildRoutes } from './routes.js';
import { pool } from './db/pool.js';

function sanitizeReturnTo(value: unknown) {
  if (typeof value !== 'string') return '/';
  return value.startsWith('/') ? value : '/';
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY,
      host_google_id TEXT NOT NULL,
      host_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_participants (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      google_id TEXT NOT NULL,
      name TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(session_id, google_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      author_google_id TEXT,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
      ON chat_messages(session_id, created_at);
  `);
}

async function bootstrap() {
  await initDb();
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: config.frontendUrl, credentials: true }
  });

  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true
    })
  );
  app.use(express.json());
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, sameSite: 'lax' }
    })
  );

  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/auth/google', (req, res, next) => {
    const returnTo = sanitizeReturnTo(req.query.returnTo);
    (req.session as any).returnTo = returnTo;
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: returnTo
    })(req, res, next);
  });
  app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${config.frontendUrl}/?login=error` }),
    (req, res) => {
      const returnTo = sanitizeReturnTo((req.session as any).returnTo ?? req.query.state);
      delete (req.session as any).returnTo;
      res.redirect(`${config.frontendUrl}${returnTo}`);
    }
  );
  app.post('/auth/logout', (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session.destroy(() => res.json({ ok: true }));
    });
  });

  io.on('connection', (socket) => {
    socket.on('join_session_room', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
    });
  });

  const service = new ChatService();
  app.use(
    '/api',
    buildRoutes(service, (event) => {
      io.to(`session:${event.sessionId}`).emit(event.type, event.payload);
    })
  );

  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(400).json({ error: error.message ?? 'Error inesperado' });
  });

  server.listen(config.port, () => {
    console.log(`Backend en http://localhost:${config.port}`);
  });
}

bootstrap();
