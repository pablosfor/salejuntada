import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './config.js';

export type SessionUser = {
  googleId: string;
  displayName: string;
  email?: string;
};

export function configurePassport() {
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user: Express.User, done) => done(null, user));

  if (!config.googleClientId || !config.googleClientSecret) {
    console.warn('Google OAuth no configurado. Definí GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.');
    return passport;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl
      },
      (_accessToken, _refreshToken, profile, done) => {
        done(null, {
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value
        } as SessionUser);
      }
    )
  );

  return passport;
}
