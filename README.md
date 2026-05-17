# SaleJuntada

App web para coordinar una fecha grupal en español argentino.

## Qué resuelve

- Host entra con Google y crea una conversación para coordinar una juntada.
- Se genera un link para compartir con invitados autenticados con Google.
- Todos conversan con un organizador virtual basado en ChatGPT.
- El organizador solo consulta disponibilidad/preferencias del próximo mes y propone días/horarios posibles.
- Si detecta un horario viable para todos los participantes mencionados, lo celebra en la conversación.
- El backend restringe el uso: usuarios no autenticados no llaman a OpenAI y cada usuario puede enviar como máximo 1 request por segundo al organizador.

## Stack

- Frontend: React + Vite + Socket.IO client
- Backend: Node.js + Express + Passport Google OAuth + Socket.IO
- Persistencia: PostgreSQL para sesiones, participantes y mensajes.
- Infra: Docker Compose
- Modelo OpenAI fijo: `gpt-5.4-mini`.

## Ejecutar

1. Copiar `.env.example` a `.env` y completar credenciales Google y `OPENAI_API_KEY`.
2. Levantar:

```bash
docker compose up --build
```

3. Abrir `http://localhost:5173`.

## Tests

```bash
npm install
npm run test
```

## Nota OAuth Google

Necesitás crear OAuth Client ID en Google Cloud Console, habilitar `http://localhost:4000/auth/google/callback` como callback y cargar credenciales por variables de entorno.
