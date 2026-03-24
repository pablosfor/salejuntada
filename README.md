# SaleJuntada

App web para coordinar una fecha grupal en español argentino.

## Qué resuelve

- Host crea una juntada con duración y rango de fechas.
- Se genera un link para compartir.
- Cada buddy (incluyendo host) entra con Google y carga disponibilidad en franjas que aplican a días de semana.
- El host ve notificaciones en vivo con cada respuesta.
- Las opciones muestran intersección de horarios entre quienes ya respondieron.
- Si existe match total y alcanzó la cantidad esperada de respuestas, se dispara aviso especial (confetti + fondo verde).
- El host elige fecha final y se notifica en vivo.

## Stack

- Frontend: React + Vite + Socket.IO client
- Backend: Node.js + Express + Passport Google OAuth + Socket.IO
- Storage: PostgreSQL
- Infra: Docker Compose
- Arquitectura de persistencia: interfaz de storage (`IJuntadaStorage`) + implementación PostgreSQL con inyección de dependencia en `JuntadaService`.

## Ejecutar

1. Copiar `.env.example` a `.env` y completar credenciales Google.
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
