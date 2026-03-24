import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { api, authUrl, logoutUrl } from './api/client';
import { buildRangesFromRules, Rule } from './utils/availability';
import './styles.css';

type MeResponse = { user: { googleId: string; displayName: string } | null };

function App() {
  return (
    <BrowserRouter>
      <div className="container">
        <HomeOrJuntada />
      </div>
    </BrowserRouter>
  );
}

function HomeOrJuntada() {
  const params = window.location.pathname.match(/^\/j\/(.+)$/);
  if (params) {
    return <JuntadaPage juntadaId={params[1]} />;
  }
  return <HomePage />;
}

function HomePage() {
  const [me, setMe] = useState<MeResponse['user']>(null);
  const [durationHours, setDurationHours] = useState(2);
  const [expectedParticipants, setExpectedParticipants] = useState(5);
  const [dateFrom, setDateFrom] = useState('2026-04-01T00:00');
  const [dateTo, setDateTo] = useState('2026-04-14T23:30');
  const [link, setLink] = useState('');

  useEffect(() => {
    api<MeResponse>('/me').then((data) => setMe(data.user)).catch(() => setMe(null));
  }, []);

  async function createJuntada() {
    const payload = {
      durationHours,
      expectedParticipants,
      dateFrom: new Date(dateFrom).toISOString(),
      dateTo: new Date(dateTo).toISOString()
    };
    const result = await api<{ link: string }>('/juntadas', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setLink(result.link);
  }

  return (
    <section className="card">
      <h1>SaleJuntada 🇦🇷</h1>
      <p>Coordiná fecha con tus buddies sin vueltas.</p>
      {!me ? (
        <a className="btn" href={authUrl}>Entrar con Google</a>
      ) : (
        <>
          <p>Hola, <strong>{me.displayName}</strong>.</p>
          <div className="grid">
            <label>Duración (horas)
              <input type="number" value={durationHours} min={1} onChange={(e) => setDurationHours(Number(e.target.value))} />
            </label>
            <label>Cantidad esperada
              <input type="number" value={expectedParticipants} min={1} onChange={(e) => setExpectedParticipants(Number(e.target.value))} />
            </label>
            <label>Desde
              <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label>Hasta
              <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
          <button className="btn" onClick={createJuntada}>Crear juntada</button>
          {link && <p>Link para compartir: <a href={link}>{link}</a></p>}
          <button className="btn secondary" onClick={() => fetch(logoutUrl, { method: 'POST', credentials: 'include' }).then(() => location.reload())}>Salir</button>
        </>
      )}
    </section>
  );
}

function JuntadaPage({ juntadaId }: { juntadaId: string }) {
  const [state, setState] = useState<any>(null);
  const [options, setOptions] = useState<any>({ options: [], respondedCount: 0, fullMatch: false });
  const [messages, setMessages] = useState<string[]>([]);
  const [rules, setRules] = useState<Rule[]>([{ weekDays: [2], startTime: '19:00', endTime: '22:30' }]);

  useEffect(() => {
    api('/juntadas/' + juntadaId + '/join', { method: 'POST' }).then(() => refresh());
    const socket = io(import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000', { withCredentials: true });
    socket.emit('join_juntada_room', juntadaId);
    socket.on('participant_response', (payload: any) => setMessages((m) => [`Respondió ${payload.participantName}`, ...m]));
    socket.on('options_updated', (payload: any) => setOptions(payload));
    socket.on('full_match', (payload: any) => {
      setOptions(payload);
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
      setMessages((m) => ['🎉 ¡Match total! Ya hay horarios para todos.', ...m]);
      document.body.classList.add('fullmatch');
      setTimeout(() => document.body.classList.remove('fullmatch'), 3500);
    });
    socket.on('finalized', (payload: any) => setMessages((m) => [`✅ Fecha elegida: ${new Date(payload.chosenStart).toLocaleString('es-AR')}`, ...m]));
    return () => socket.disconnect();
  }, [juntadaId]);

  async function refresh() {
    const s = await api<any>('/juntadas/' + juntadaId);
    setState(s);
    const o = await api<any>('/juntadas/' + juntadaId + '/options');
    setOptions(o);
  }

  useEffect(() => {
    refresh();
  }, [juntadaId]);

  const rangePreview = useMemo(() => {
    if (!state) return 0;
    return buildRangesFromRules(state.juntada.dateFrom, state.juntada.dateTo, rules).length;
  }, [rules, state]);

  async function submitAvailability() {
    if (!state) return;
    const ranges = buildRangesFromRules(state.juntada.dateFrom, state.juntada.dateTo, rules);
    await api('/juntadas/' + juntadaId + '/availability', {
      method: 'POST',
      body: JSON.stringify({ ranges })
    });
    await refresh();
  }

  async function finalize(startAt: string) {
    await api('/juntadas/' + juntadaId + '/finalize', {
      method: 'POST',
      body: JSON.stringify({ chosenStart: startAt })
    });
    await refresh();
  }

  if (!state) return <p>Cargando...</p>;

  return (
    <section className="card">
      <h2>Juntada de {state.juntada.hostName}</h2>
      <p>Duración: {state.juntada.durationMinutes / 60} h · Esperados: {state.juntada.expectedParticipants} · Respondieron: {options.respondedCount}</p>
      <h3>Tu disponibilidad</h3>
      {rules.map((rule, idx) => (
        <div key={idx} className="ruleRow">
          <select multiple value={rule.weekDays.map(String)} onChange={(e) => {
            const vals = Array.from(e.target.selectedOptions).map((x) => Number(x.value));
            setRules((prev) => prev.map((r, i) => i === idx ? { ...r, weekDays: vals } : r));
          }}>
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((label, i) => <option value={i} key={i}>{label}</option>)}
          </select>
          <input type="time" step={1800} value={rule.startTime} onChange={(e) => setRules((prev) => prev.map((r, i) => i === idx ? { ...r, startTime: e.target.value } : r))} />
          <input type="time" step={1800} value={rule.endTime} onChange={(e) => setRules((prev) => prev.map((r, i) => i === idx ? { ...r, endTime: e.target.value } : r))} />
        </div>
      ))}
      <button className="btn secondary" onClick={() => setRules((prev) => [...prev, { weekDays: [4], startTime: '19:00', endTime: '22:30' }])}>+ Agregar franja</button>
      <p>Se van a cargar {rangePreview} bloques concretos dentro del rango de fechas.</p>
      <button className="btn" onClick={submitAvailability}>Guardar disponibilidad</button>

      <h3>Opciones que matchean para quienes respondieron</h3>
      <ul>
        {options.options.slice(0, 20).map((option: any) => (
          <li key={option.startAt}>
            {new Date(option.startAt).toLocaleString('es-AR')} - {new Date(option.endAt).toLocaleTimeString('es-AR')}
            {state.isHost && state.juntada.status === 'open' && <button className="mini" onClick={() => finalize(option.startAt)}>Elegir</button>}
          </li>
        ))}
      </ul>

      {state.isHost && (
        <>
          <h3>Notificaciones en vivo</h3>
          <ul>{messages.map((message, i) => <li key={i}>{message}</li>)}</ul>
        </>
      )}
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
