/// <reference types="vite/client" />

declare module 'canvas-confetti' {
  type ConfettiOptions = {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
  };

  export default function confetti(options?: ConfettiOptions): Promise<null>;
}
