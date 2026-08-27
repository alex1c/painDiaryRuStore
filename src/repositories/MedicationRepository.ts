/**
 * Repository for medication catalog entries and intake records.
 */

import type { MedicationEffect } from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { Medication, MedicationIntake } from '@/src/domain/types';
import {
  validateMedicationEffect,
  validateMedicationName,
} from '@/src/domain/validation';
import type { SqlDatabase } from '@/src/db/types';
import { createId } from '@/src/utils/id';
import { nowIsoUtc } from '@/src/utils/timestamps';

type MedicationRow = {
  id: string;
  name: string;
  default_dose: string | null;
  unit: string | null;
  notes: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
};

type IntakeRow = {
  id: string;
  episode_id: string | null;
  medication_id: string;
  taken_at: string;
  dose: string | null;
  unit: string | null;
  effect: string | null;
  effect_rated_at: string | null;
  created_at: string;
};

export type MedicationInput = {
  name: string;
  defaultDose?: string | null;
  unit?: string | null;
  notes?: string | null;
  isArchived?: boolean;
};

export type MedicationIntakeInput = {
  medicationId: string;
  takenAt: string;
  episodeId?: string | null;
  dose?: string | null;
  unit?: string | null;
  effect?: MedicationEffect | null;
  effectRatedAt?: string | null;
};

export class MedicationRepository {
  constructor(private readonly db: SqlDatabase) {}

  createMedication(input: MedicationInput): Medication {
    validateMedicationName(input.name);

    const id = createId();
    const now = nowIsoUtc();
    const isArchived = input.isArchived ? 1 : 0;

    try {
      this.db.run(
        `INSERT INTO medications
          (id, name, default_dose, unit, notes, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.name.trim(),
          input.defaultDose ?? null,
          input.unit ?? null,
          input.notes ?? null,
          isArchived,
          now,
          now,
        ]
      );
    } catch (err) {
      throw new StorageError('Failed to create medication', err);
    }

    return {
      id,
      name: input.name.trim(),
      defaultDose: input.defaultDose ?? null,
      unit: input.unit ?? null,
      notes: input.notes ?? null,
      isArchived: Boolean(isArchived),
      createdAt: now,
      updatedAt: now,
    };
  }

  getMedicationById(id: string): Medication | null {
    const row = this.db.getFirst<MedicationRow>(
      'SELECT * FROM medications WHERE id = ?',
      [id]
    );
    return row ? mapMedication(row) : null;
  }

  /** Lists medications; by default excludes archived ones. */
  listMedications(options?: { includeArchived?: boolean }): Medication[] {
    const includeArchived = options?.includeArchived ?? false;
    const rows = includeArchived
      ? this.db.getAll<MedicationRow>(
          'SELECT * FROM medications ORDER BY name COLLATE NOCASE ASC'
        )
      : this.db.getAll<MedicationRow>(
          `SELECT * FROM medications
           WHERE is_archived = 0
           ORDER BY name COLLATE NOCASE ASC`
        );
    return rows.map(mapMedication);
  }

  updateMedication(id: string, patch: Partial<MedicationInput>): Medication {
    const existing = this.getMedicationById(id);
    if (!existing) {
      throw new StorageError(`Medication not found: ${id}`);
    }

    const name = patch.name !== undefined ? patch.name : existing.name;
    validateMedicationName(name);

    const defaultDose =
      patch.defaultDose !== undefined
        ? patch.defaultDose ?? null
        : existing.defaultDose;
    const unit = patch.unit !== undefined ? patch.unit ?? null : existing.unit;
    const notes =
      patch.notes !== undefined ? patch.notes ?? null : existing.notes;
    const isArchived =
      patch.isArchived !== undefined ? patch.isArchived : existing.isArchived;
    const updatedAt = nowIsoUtc();

    try {
      this.db.run(
        `UPDATE medications
         SET name = ?, default_dose = ?, unit = ?, notes = ?, is_archived = ?, updated_at = ?
         WHERE id = ?`,
        [
          name.trim(),
          defaultDose,
          unit,
          notes,
          isArchived ? 1 : 0,
          updatedAt,
          id,
        ]
      );
    } catch (err) {
      throw new StorageError(`Failed to update medication ${id}`, err);
    }

    return {
      ...existing,
      name: name.trim(),
      defaultDose,
      unit,
      notes,
      isArchived,
      updatedAt,
    };
  }

  /** Soft-archives a medication so it stays available for historical intakes. */
  archiveMedication(id: string): Medication {
    return this.updateMedication(id, { isArchived: true });
  }

  createIntake(input: MedicationIntakeInput): MedicationIntake {
    if (!this.getMedicationById(input.medicationId)) {
      throw new StorageError(`Medication not found: ${input.medicationId}`);
    }

    if (input.effect != null) {
      validateMedicationEffect(input.effect);
    }

    const id = createId();
    const createdAt = nowIsoUtc();
    const episodeId = input.episodeId ?? null;
    const effect = input.effect ?? null;
    const effectRatedAt = input.effectRatedAt ?? null;

    try {
      this.db.run(
        `INSERT INTO medication_intakes
          (id, episode_id, medication_id, taken_at, dose, unit, effect, effect_rated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          episodeId,
          input.medicationId,
          input.takenAt,
          input.dose ?? null,
          input.unit ?? null,
          effect,
          effectRatedAt,
          createdAt,
        ]
      );
    } catch (err) {
      throw new StorageError('Failed to create medication intake', err);
    }

    return {
      id,
      episodeId,
      medicationId: input.medicationId,
      takenAt: input.takenAt,
      dose: input.dose ?? null,
      unit: input.unit ?? null,
      effect,
      effectRatedAt,
      createdAt,
    };
  }

  getIntakeById(id: string): MedicationIntake | null {
    const row = this.db.getFirst<IntakeRow>(
      'SELECT * FROM medication_intakes WHERE id = ?',
      [id]
    );
    return row ? mapIntake(row) : null;
  }

  listIntakesForEpisode(episodeId: string): MedicationIntake[] {
    const rows = this.db.getAll<IntakeRow>(
      `SELECT * FROM medication_intakes
       WHERE episode_id = ?
       ORDER BY taken_at ASC`,
      [episodeId]
    );
    return rows.map(mapIntake);
  }

  /**
   * Updates effect rating on an existing intake.
   * Sets effect_rated_at to now when not provided.
   */
  setIntakeEffect(
    intakeId: string,
    effect: MedicationEffect,
    effectRatedAt: string = nowIsoUtc()
  ): MedicationIntake {
    validateMedicationEffect(effect);

    const existing = this.getIntakeById(intakeId);
    if (!existing) {
      throw new StorageError(`Intake not found: ${intakeId}`);
    }

    try {
      this.db.run(
        `UPDATE medication_intakes
         SET effect = ?, effect_rated_at = ?
         WHERE id = ?`,
        [effect, effectRatedAt, intakeId]
      );
    } catch (err) {
      throw new StorageError(`Failed to set intake effect ${intakeId}`, err);
    }

    return {
      ...existing,
      effect,
      effectRatedAt,
    };
  }

  deleteIntake(id: string): void {
    try {
      const result = this.db.run('DELETE FROM medication_intakes WHERE id = ?', [
        id,
      ]);
      if (result.changes === 0) {
        throw new StorageError(`Intake not found: ${id}`);
      }
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`Failed to delete intake ${id}`, err);
    }
  }
}

function mapMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    defaultDose: row.default_dose,
    unit: row.unit,
    notes: row.notes,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIntake(row: IntakeRow): MedicationIntake {
  return {
    id: row.id,
    episodeId: row.episode_id,
    medicationId: row.medication_id,
    takenAt: row.taken_at,
    dose: row.dose,
    unit: row.unit,
    effect: row.effect as MedicationEffect | null,
    effectRatedAt: row.effect_rated_at,
    createdAt: row.created_at,
  };
}
