export type User = {
  googleId: string;
  displayName: string;
  email?: string;
};

export type Juntada = {
  id: string;
  hostGoogleId: string;
  hostName: string;
  durationMinutes: number;
  expectedParticipants: number;
  dateFrom: string;
  dateTo: string;
  status: 'open' | 'closed';
  chosenStart: string | null;
  createdAt: string;
};

export type Participant = {
  id: string;
  juntadaId: string;
  googleId: string;
  name: string;
  responded: boolean;
  lastResponseAt: string | null;
};

export type AvailabilityRange = {
  startAt: string;
  endAt: string;
};

export type CandidateOption = {
  startAt: string;
  endAt: string;
};

export type JuntadaWithParticipants = {
  juntada: Juntada;
  participants: Participant[];
};
