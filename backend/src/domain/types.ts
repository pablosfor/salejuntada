export type User = {
  googleId: string;
  displayName: string;
  email?: string;
};

export type ChatSession = {
  id: string;
  hostGoogleId: string;
  hostName: string;
  status: 'open' | 'closed';
  createdAt: string;
};

export type ChatParticipant = {
  id: string;
  sessionId: string;
  googleId: string;
  name: string;
  joinedAt: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  authorGoogleId: string | null;
  authorName: string;
  content: string;
  createdAt: string;
};

export type AvailabilityStatus = 'unknown' | 'declined' | 'no_match' | 'matched';

export type ParticipantAvailability = {
  googleId: string;
  name: string;
  status: AvailabilityStatus;
  summary: string;
  candidateSummary: string | null;
  updatedAt: string | null;
};

export type AvailabilityCandidate = {
  startAt: string | null;
  endAt: string | null;
  summary: string;
};

export type AvailabilityContext = {
  participants: Record<string, ParticipantAvailability>;
  candidate: AvailabilityCandidate | null;
  updatedAt: string | null;
};

export type ChatSessionState = {
  session: ChatSession;
  participants: ChatParticipant[];
  messages: ChatMessage[];
  availabilityContext: AvailabilityContext;
};
