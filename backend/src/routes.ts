import { Router } from 'express';
import { z } from 'zod';
import { JuntadaService } from './services/JuntadaService.js';

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Tenés que iniciar sesión con Google.' });
  }
  next();
}

export function buildRoutes(service: JuntadaService, notify: (event: { juntadaId: string; type: string; payload?: unknown }) => void) {
  const router = Router();

  router.get('/health', (_req, res) => res.json({ ok: true }));

  router.get('/me', (req, res) => {
    res.json({ user: req.user ?? null });
  });

  router.post('/juntadas', requireAuth, async (req, res) => {
    const schema = z.object({
      durationHours: z.number().min(1).max(24),
      expectedParticipants: z.number().min(1).max(500),
      dateFrom: z.string().datetime(),
      dateTo: z.string().datetime()
    });
    const payload = schema.parse(req.body);
    const juntada = await service.createJuntada({
      user: req.user,
      ...payload
    });
    await service.joinJuntada(juntada.id, req.user);
    res.json({ juntada, link: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/j/${juntada.id}` });
  });

  router.get('/juntadas/:id', requireAuth, async (req, res) => {
    const state = await service.getJuntadaState(req.params.id);
    if (!state) return res.status(404).json({ error: 'No existe esa juntada.' });
    const me = state.participants.find((participant) => participant.googleId === req.user.googleId) ?? null;
    res.json({ ...state, me, isHost: state.juntada.hostGoogleId === req.user.googleId });
  });

  router.post('/juntadas/:id/join', requireAuth, async (req, res) => {
    const participant = await service.joinJuntada(req.params.id, req.user);
    res.json({ participant });
  });

  router.post('/juntadas/:id/availability', requireAuth, async (req, res) => {
    const schema = z.object({
      ranges: z.array(z.object({ startAt: z.string().datetime(), endAt: z.string().datetime() }))
    });
    const payload = schema.parse(req.body);
    const participant = await service.submitAvailability(req.params.id, req.user, payload.ranges);
    const options = await service.getCandidateOptions(req.params.id);

    notify({
      juntadaId: req.params.id,
      type: 'participant_response',
      payload: { participantName: participant.name }
    });
    notify({ juntadaId: req.params.id, type: 'options_updated', payload: options });
    if (options.fullMatch) {
      notify({ juntadaId: req.params.id, type: 'full_match', payload: options });
    }

    res.json({ ok: true, participant, options });
  });

  router.get('/juntadas/:id/options', requireAuth, async (req, res) => {
    const options = await service.getCandidateOptions(req.params.id);
    res.json(options);
  });

  router.post('/juntadas/:id/finalize', requireAuth, async (req, res) => {
    const schema = z.object({ chosenStart: z.string().datetime() });
    const payload = schema.parse(req.body);
    await service.chooseFinalDate(req.params.id, req.user.googleId, payload.chosenStart);
    notify({ juntadaId: req.params.id, type: 'finalized', payload });
    res.json({ ok: true });
  });

  return router;
}
