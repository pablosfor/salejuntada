import { v4 as uuid } from 'uuid';
import { pool } from '../db/pool.js';
import { AvailabilityRange, Juntada, JuntadaWithParticipants, Participant } from '../domain/types.js';
import { IJuntadaStorage } from './IJuntadaStorage.js';

function mapJuntada(row: any): Juntada {
  return {
    id: row.id,
    hostGoogleId: row.host_google_id,
    hostName: row.host_name,
    durationMinutes: row.duration_minutes,
    expectedParticipants: row.expected_participants,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    status: row.status,
    chosenStart: row.chosen_start,
    createdAt: row.created_at
  };
}

function mapParticipant(row: any): Participant {
  return {
    id: row.id,
    juntadaId: row.juntada_id,
    googleId: row.google_id,
    name: row.name,
    responded: row.responded,
    lastResponseAt: row.last_response_at
  };
}

export class PostgresJuntadaStorage implements IJuntadaStorage {
  async createJuntada(input: {
    hostGoogleId: string;
    hostName: string;
    durationMinutes: number;
    expectedParticipants: number;
    dateFrom: string;
    dateTo: string;
  }): Promise<Juntada> {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO juntadas (id, host_google_id, host_name, duration_minutes, expected_participants, date_from, date_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, input.hostGoogleId, input.hostName, input.durationMinutes, input.expectedParticipants, input.dateFrom, input.dateTo]
    );
    return mapJuntada(result.rows[0]);
  }

  async getJuntada(id: string): Promise<Juntada | null> {
    const result = await pool.query('SELECT * FROM juntadas WHERE id = $1', [id]);
    return result.rows[0] ? mapJuntada(result.rows[0]) : null;
  }

  async ensureParticipant(juntadaId: string, user: { googleId: string; name: string }): Promise<Participant> {
    const existing = await pool.query(
      `SELECT * FROM participants WHERE juntada_id = $1 AND google_id = $2`,
      [juntadaId, user.googleId]
    );
    if (existing.rows[0]) {
      return mapParticipant(existing.rows[0]);
    }
    const created = await pool.query(
      `INSERT INTO participants (id, juntada_id, google_id, name)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [uuid(), juntadaId, user.googleId, user.name]
    );
    return mapParticipant(created.rows[0]);
  }

  async upsertAvailabilities(participantId: string, ranges: AvailabilityRange[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM availabilities WHERE participant_id = $1', [participantId]);
      for (const range of ranges) {
        await client.query(
          `INSERT INTO availabilities (id, participant_id, start_at, end_at)
           VALUES ($1,$2,$3,$4)`,
          [uuid(), participantId, range.startAt, range.endAt]
        );
      }
      await client.query(
        `UPDATE participants SET responded = TRUE, last_response_at = NOW() WHERE id = $1`,
        [participantId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAvailabilitiesByJuntada(juntadaId: string): Promise<Record<string, AvailabilityRange[]>> {
    const result = await pool.query(
      `SELECT a.participant_id, a.start_at, a.end_at
       FROM availabilities a
       JOIN participants p ON p.id = a.participant_id
       WHERE p.juntada_id = $1`,
      [juntadaId]
    );
    return result.rows.reduce((acc: Record<string, AvailabilityRange[]>, row: any) => {
      const key = row.participant_id;
      acc[key] = acc[key] ?? [];
      acc[key].push({ startAt: row.start_at, endAt: row.end_at });
      return acc;
    }, {});
  }

  async getParticipants(juntadaId: string): Promise<Participant[]> {
    const result = await pool.query(`SELECT * FROM participants WHERE juntada_id = $1 ORDER BY name ASC`, [juntadaId]);
    return result.rows.map(mapParticipant);
  }

  async markJuntadaChosen(juntadaId: string, chosenStart: string): Promise<void> {
    await pool.query(`UPDATE juntadas SET status = 'closed', chosen_start = $2 WHERE id = $1`, [juntadaId, chosenStart]);
  }

  async getJuntadaWithParticipants(juntadaId: string): Promise<JuntadaWithParticipants | null> {
    const juntada = await this.getJuntada(juntadaId);
    if (!juntada) return null;
    const participants = await this.getParticipants(juntadaId);
    return { juntada, participants };
  }
}
