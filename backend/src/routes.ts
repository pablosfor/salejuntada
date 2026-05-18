import { Router } from 'express';
import { z } from 'zod';
import { User } from './domain/types.js';
import { ChatService } from './services/ChatService.js';

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Tenés que iniciar sesión con Google.' });
  }
  next();
}

const lastApiRequestByUser = new Map<string, number>();

function enforceApiRateLimit(req: any, res: any, next: any) {
  const now = Date.now();
  const googleId = req.user?.googleId;
  const lastRequestAt = lastApiRequestByUser.get(googleId) ?? 0;
  if (now - lastRequestAt < 1000) {
    return res.status(429).json({ error: 'Máximo 1 consulta al organizador por segundo.' });
  }
  lastApiRequestByUser.set(googleId, now);
  next();
}

export function buildRoutes(service: ChatService, notify: (event: { sessionId: string; type: string; payload?: unknown }) => void) {
  const router = Router();

  router.get('/health', (_req, res) => res.json({ ok: true }));

  router.get('/me', (req, res) => {
    res.json({ user: req.user ?? null });
  });

  router.post('/sessions', requireAuth, async (req, res) => {
    const user = req.user as User;
    const session = await service.createSession(user);
    res.json({ session, link: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/j/${session.id}` });
  });

  router.get('/sessions/:id', requireAuth, async (req, res) => {
    const user = req.user as User;
    await service.joinSession(req.params.id, user);
    const state = await service.getState(req.params.id);
    if (!state) return res.status(404).json({ error: 'No existe esa juntada.' });
    const me = state.participants.find((participant) => participant.googleId === user.googleId) ?? null;
    res.json({ ...state, me, isHost: state.session.hostGoogleId === user.googleId });
  });

  router.post('/sessions/:id/messages', requireAuth, enforceApiRateLimit, async (req, res) => {
    const user = req.user as User;
    const schema = z.object({
      content: z.string().trim().min(1).max(2000)
    });
    const { content } = schema.parse(req.body);
    const result = await service.sendUserMessage(req.params.id, user, content);

    notify({ sessionId: req.params.id, type: 'message_created', payload: result.userMessage });
    notify({ sessionId: req.params.id, type: 'message_created', payload: result.assistantMessage });
    notify({ sessionId: req.params.id, type: 'availability_context_updated', payload: result.availabilityContext });

    res.json(result);
  });

  return router;
}
