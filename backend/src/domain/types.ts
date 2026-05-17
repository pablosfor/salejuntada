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

export type ChatSessionState = {
  session: ChatSession;
  participants: ChatParticipant[];
  messages: ChatMessage[];
};
