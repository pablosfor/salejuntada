import { AvailabilityRange, Juntada, JuntadaWithParticipants, Participant } from '../domain/types.js';

export interface IJuntadaStorage {
  createJuntada(input: {
    hostGoogleId: string;
    hostName: string;
    durationMinutes: number;
    expectedParticipants: number;
    dateFrom: string;
    dateTo: string;
  }): Promise<Juntada>;
  getJuntada(id: string): Promise<Juntada | null>;
  ensureParticipant(juntadaId: string, user: { googleId: string; name: string }): Promise<Participant>;
  upsertAvailabilities(participantId: string, ranges: AvailabilityRange[]): Promise<void>;
  getAvailabilitiesByJuntada(juntadaId: string): Promise<Record<string, AvailabilityRange[]>>;
  getParticipants(juntadaId: string): Promise<Participant[]>;
  markJuntadaChosen(juntadaId: string, chosenStart: string): Promise<void>;
  getJuntadaWithParticipants(juntadaId: string): Promise<JuntadaWithParticipants | null>;
}
