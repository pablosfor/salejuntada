import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { configurePassport } from './auth.js';
import { PostgresJuntadaStorage } from './storage/PostgresJuntadaStorage.js';
import { JuntadaService } from './services/JuntadaService.js';
import { buildRoutes } from './routes.js';
import { pool } from './db/pool.js';

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS juntadas (
      id UUID PRIMARY KEY,
      host_google_id TEXT NOT NULL,
      host_name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      expected_participants INTEGER NOT NULL,
      date_from TIMESTAMPTZ NOT NULL,
      date_to TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      chosen_start TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS participants (
      id UUID PRIMARY KEY,
      juntada_id UUID NOT NULL REFERENCES juntadas(id) ON DELETE CASCADE,
      google_id TEXT NOT NULL,
      name TEXT NOT NULL,
      responded BOOLEAN NOT NULL DEFAULT FALSE,
      last_response_at TIMESTAMPTZ,
      UNIQUE(juntada_id, google_id)
    );

    CREATE TABLE IF NOT EXISTS availabilities (
      id UUID PRIMARY KEY,
      participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL
    );
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

  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${config.frontendUrl}/?login=error` }),
    (_req, res) => {
      res.redirect(config.frontendUrl);
    }
  );
  app.post('/auth/logout', (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session.destroy(() => res.json({ ok: true }));
    });
  });

  io.on('connection', (socket) => {
    socket.on('join_juntada_room', (juntadaId: string) => {
      socket.join(`juntada:${juntadaId}`);
    });
  });

  const service = new JuntadaService(new PostgresJuntadaStorage());
  app.use(
    '/api',
    buildRoutes(service, (event) => {
      io.to(`juntada:${event.juntadaId}`).emit(event.type, event.payload);
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
