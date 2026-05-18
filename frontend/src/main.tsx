import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { ApiError, api, authUrl, buildAuthUrl, logoutUrl } from './api/client';
import './styles.css';

type MeResponse = { user: { googleId: string; displayName: string } | null };

type ChatMessage = {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  authorGoogleId: string | null;
  authorName: string;
  content: string;
  createdAt: string;
};

type AvailabilityStatus = 'unknown' | 'declined' | 'no_match' | 'matched';

type ParticipantAvailability = {
  googleId: string;
  name: string;
  status: AvailabilityStatus;
  summary: string;
  candidateSummary: string | null;
  updatedAt: string | null;
};

type AvailabilityCandidate = {
  startAt: string | null;
  endAt: string | null;
  summary: string;
};

type AvailabilityContext = {
  participants: Record<string, ParticipantAvailability>;
  candidate: AvailabilityCandidate | null;
  updatedAt: string | null;
};

type SessionState = {
  session: {
    id: string;
    hostGoogleId: string;
    hostName: string;
    status: 'open' | 'closed';
  };
  participants: Array<{ googleId: string; name: string }>;
  messages: ChatMessage[];
  availabilityContext: AvailabilityContext;
  me: { googleId: string; name: string } | null;
  isHost: boolean;
};

function App() {
  return (
    <BrowserRouter>
      <HomeOrJuntada />
    </BrowserRouter>
  );
}

function HomeOrJuntada() {
  const params = window.location.pathname.match(/^\/j\/(.+)$/);
  if (params) return <ChatPage sessionId={params[1]} />;
  return <HomePage />;
}

function HomePage() {
  const [me, setMe] = useState<MeResponse['user']>(null);
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<MeResponse>('/me')
      .then((data) => setMe(data.user))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  async function createSession() {
    setError('');
    try {
      const result = await api<{ link: string }>('/sessions', { method: 'POST' });
      setLink(result.link);
      window.location.href = result.link;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'No se pudo crear la juntada.');
    }
  }

  if (loading) return <main className="pageShell"><section className="panel">Cargando…</section></main>;

  return (
    <main className="pageShell">
      <section className="panel homePanel">
        <div>
          <p className="eyebrow">SaleJuntada</p>
          <h1>Organizador virtual de juntadas</h1>
          <p className="lede">Creá una conversación y compartí el link para coordinar disponibilidad con ayuda de ChatGPT.</p>
        </div>

        {!me ? (
          <a className="btn" href={authUrl}>Entrar con Google</a>
        ) : (
          <div className="homeActions">
            <p>Hola, <strong>{me.displayName}</strong>.</p>
            <button className="btn" onClick={createSession}>Crear conversación</button>
            {link && (
              <p className="shareLink">
                Link para compartir: <a href={link}>{link}</a>
              </p>
            )}
            {error && <p className="errorText">{error}</p>}
            <button className="btn secondary" onClick={() => fetch(logoutUrl, { method: 'POST', credentials: 'include' }).then(() => location.reload())}>Salir</button>
          </div>
        )}
      </section>
    </main>
  );
}

function ChatPage({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState('');
  const [authState, setAuthState] = useState<'checking' | 'ready' | 'redirecting'>('checking');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const availabilityItems = useMemo(() => {
    if (!state) return [];
    const byGoogleId = new Map<string, ParticipantAvailability>();
    for (const item of Object.values(state.availabilityContext.participants)) {
      byGoogleId.set(item.googleId, item);
    }
    for (const participant of state.participants) {
      if (!byGoogleId.has(participant.googleId)) {
        byGoogleId.set(participant.googleId, {
      googleId: participant.googleId,
      name: participant.name,
      status: 'unknown' as const,
      summary: '',
      candidateSummary: null,
      updatedAt: null
        });
      }
    }
    return Array.from(byGoogleId.values());
  }, [state]);
  const participantsLabel = useMemo(() => {
    return availabilityItems.map((participant) => participant.name).join(', ');
  }, [availabilityItems]);

  function redirectToLogin() {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.href = buildAuthUrl(returnTo);
  }

  function handleApiError(nextError: unknown) {
    if (nextError instanceof ApiError && nextError.status === 401) {
      setAuthState('redirecting');
      redirectToLogin();
      return true;
    }
    return false;
  }

  async function refresh() {
    const nextState = await api<SessionState>('/sessions/' + sessionId);
    setState(nextState);
    setMessages(nextState.messages);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const me = await api<MeResponse>('/me');
        if (cancelled) return;
        if (!me.user) {
          setAuthState('redirecting');
          redirectToLogin();
          return;
        }

        setAuthState('ready');
        await refresh();
      } catch (nextError) {
        if (!cancelled && !handleApiError(nextError)) {
          setError(nextError instanceof Error ? nextError.message : 'No se pudo cargar la conversación.');
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (authState !== 'ready') return;

    const socket = io(import.meta.env.VITE_BACKEND_URL || undefined, { withCredentials: true });
    socket.emit('join_session_room', sessionId);
    socket.on('message_created', (message: ChatMessage) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      if (message.role === 'assistant' && message.content.includes('¡Tenemos juntada!')) {
        confetti({ particleCount: 140, spread: 90, origin: { y: 0.7 } });
      }
    });
    socket.on('availability_context_updated', (availabilityContext: AvailabilityContext) => {
      setState((current) => current ? { ...current, availabilityContext } : current);
    });
    return () => {
      socket.disconnect();
    };
  }, [authState, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError('');
    setContent('');
    try {
      const result = await api<{ userMessage: ChatMessage; assistantMessage: ChatMessage; availabilityContext: AvailabilityContext }>('/sessions/' + sessionId + '/messages', {
        method: 'POST',
        body: JSON.stringify({ content: trimmed })
      });
      setMessages((current) => mergeMessages(current, [result.userMessage, result.assistantMessage]));
      setState((current) => current ? { ...current, availabilityContext: result.availabilityContext } : current);
    } catch (nextError) {
      setContent(trimmed);
      if (!handleApiError(nextError)) {
        setError(nextError instanceof Error ? nextError.message : 'No se pudo enviar el mensaje.');
      }
    } finally {
      setSending(false);
    }
  }

  if (authState === 'redirecting') {
    return <main className="pageShell"><section className="panel">Redirigiendo al login…</section></main>;
  }

  if (!state && !error) {
    return <main className="pageShell"><section className="panel">Cargando conversación…</section></main>;
  }

  return (
    <main className="chatShell">
      <section className="chatWindow">
        <header className="chatHeader">
          <div>
            <p className="eyebrow">Juntada de {state?.session.hostName ?? 'SaleJuntada'}</p>
            <h1>Organizador virtual</h1>
            <p className="lede">{participantsLabel || 'Todavía no hay invitados conectados.'}</p>
          </div>
          <button className="btn secondary" onClick={() => fetch(logoutUrl, { method: 'POST', credentials: 'include' }).then(() => location.reload())}>Salir</button>
        </header>

        <section className="availabilityPanel">
          <div className="availabilityPanelHeader">
            <div>
              <p className="eyebrow">Disponibilidad</p>
              <h2>Estado de participantes</h2>
            </div>
            <p className="candidateSummary">
              {state?.availabilityContext.candidate?.summary ?? 'Sin día candidato todavía.'}
            </p>
          </div>
          <div className="availabilityList">
            {availabilityItems.map((item) => (
              <article key={item.googleId} className="availabilityItem">
                <span className={`trafficLight ${item.status}`} title={statusLabel(item.status)} />
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.summary || 'Todavía no indicó disponibilidad.'}</p>
                  {item.candidateSummary && <small>{item.candidateSummary}</small>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="messageStream">
          {messages.map((message) => (
            <article
              key={message.id}
              className={message.role === 'assistant' ? 'messageBubble assistant' : 'messageBubble user'}
            >
              <div className="messageMeta">
                <strong>{message.authorName}</strong>
                <span>{new Date(message.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p>{message.content}</p>
            </article>
          ))}
          {sending && <article className="messageBubble assistant pending">El organizador está pensando…</article>}
          <div ref={bottomRef} />
        </div>

        {error && <p className="errorText">{error}</p>}

        <form className="composer" onSubmit={sendMessage}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Contale tu disponibilidad o pedile que busque opciones."
            rows={2}
          />
          <button className="btn" disabled={sending || !content.trim()}>Enviar</button>
        </form>
      </section>
    </main>
  );
}

function statusLabel(status: AvailabilityStatus) {
  const labels: Record<AvailabilityStatus, string> = {
    unknown: 'Sin disponibilidad',
    declined: 'No participa',
    no_match: 'Sin coincidencia con todos',
    matched: 'Coincide con todos'
  };
  return labels[status];
}

function mergeMessages(current: ChatMessage[], next: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of next) byId.set(message.id, message);
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

createRoot(document.getElementById('root')!).render(<App />);
