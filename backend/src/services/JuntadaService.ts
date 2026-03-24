import { CandidateOption, AvailabilityRange, Participant, User } from '../domain/types.js';
import { IJuntadaStorage } from '../storage/IJuntadaStorage.js';

const SLOT_MINUTES = 30;

export class JuntadaService {
  constructor(private storage: IJuntadaStorage) {}

  async createJuntada(input: {
    user: User;
    durationHours: number;
    expectedParticipants: number;
    dateFrom: string;
    dateTo: string;
  }) {
    return this.storage.createJuntada({
      hostGoogleId: input.user.googleId,
      hostName: input.user.displayName,
      durationMinutes: input.durationHours * 60,
      expectedParticipants: input.expectedParticipants,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo
    });
  }

  async submitAvailability(juntadaId: string, user: User, ranges: AvailabilityRange[]) {
    const participant = await this.storage.ensureParticipant(juntadaId, {
      googleId: user.googleId,
      name: user.displayName
    });
    await this.storage.upsertAvailabilities(participant.id, ranges);
    return participant;
  }

  async joinJuntada(juntadaId: string, user: User) {
    return this.storage.ensureParticipant(juntadaId, {
      googleId: user.googleId,
      name: user.displayName
    });
  }

  async getJuntadaState(juntadaId: string) {
    return this.storage.getJuntadaWithParticipants(juntadaId);
  }

  async getCandidateOptions(juntadaId: string): Promise<{ options: CandidateOption[]; respondedCount: number; fullMatch: boolean }> {
    const state = await this.storage.getJuntadaWithParticipants(juntadaId);
    if (!state) {
      throw new Error('Juntada no encontrada');
    }
    const respondedParticipants = state.participants.filter((p) => p.responded);
    if (respondedParticipants.length === 0) {
      return { options: [], respondedCount: 0, fullMatch: false };
    }

    const availabilityByParticipant = await this.storage.getAvailabilitiesByJuntada(juntadaId);
    const options = computeCommonSlots(
      respondedParticipants,
      availabilityByParticipant,
      state.juntada.durationMinutes,
      state.juntada.dateFrom,
      state.juntada.dateTo
    );

    return {
      options,
      respondedCount: respondedParticipants.length,
      fullMatch: options.length > 0 && respondedParticipants.length >= state.juntada.expectedParticipants
    };
  }

  async chooseFinalDate(juntadaId: string, hostGoogleId: string, chosenStart: string) {
    const juntada = await this.storage.getJuntada(juntadaId);
    if (!juntada) throw new Error('Juntada no encontrada');
    if (juntada.hostGoogleId !== hostGoogleId) throw new Error('Solo el host puede cerrar la juntada');
    await this.storage.markJuntadaChosen(juntadaId, chosenStart);
  }
}

export function computeCommonSlots(
  participants: Participant[],
  availabilityByParticipant: Record<string, AvailabilityRange[]>,
  durationMinutes: number,
  dateFrom: string,
  dateTo: string
): CandidateOption[] {
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  const options: CandidateOption[] = [];
  const slotMs = SLOT_MINUTES * 60 * 1000;
  const durationMs = durationMinutes * 60 * 1000;

  for (let cursor = start.getTime(); cursor + durationMs <= end.getTime(); cursor += slotMs) {
    const candidateStart = new Date(cursor);
    const candidateEnd = new Date(cursor + durationMs);

    const allMatch = participants.every((participant) => {
      const ranges = availabilityByParticipant[participant.id] ?? [];
      return ranges.some((range) => new Date(range.startAt) <= candidateStart && new Date(range.endAt) >= candidateEnd);
    });

    if (allMatch) {
      options.push({
        startAt: candidateStart.toISOString(),
        endAt: candidateEnd.toISOString()
      });
    }
  }

  return options.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
