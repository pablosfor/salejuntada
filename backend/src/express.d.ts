import 'express-session';

declare global {
  namespace Express {
    interface User {
      googleId: string;
      displayName: string;
      email?: string;
    }
  }
}

export {};
