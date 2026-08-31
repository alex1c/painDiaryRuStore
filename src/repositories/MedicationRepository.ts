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
  medication_name_snapshot: string | null;
  taken_at: string;
  dose: string | null;
  unit: string | null;
  effect: string | null;
  effect_rated_at: string | null;
  created_at: string;
  updated_at: string | null;
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
  medicationNameSnapshot?: string;
};

export type MedicationIntakeUpdate = {
  medicationId?: string;
  takenAt?: string;
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
          normalizeOptionalText(input.defaultDose),
          normalizeOptionalText(input.unit),
          normalizeOptionalText(input.notes),
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
      defaultDose: normalizeOptionalText(input.defaultDose),
      unit: normalizeOptionalText(input.unit),
      notes: normalizeOptionalText(input.notes),
      isArchived: Boolean(isArchived),
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Finds an active medication by case-insensitive name or creates a new one.
   * Reactivates archived rows with the same normalized name.
   */
  getOrCreateMedication(
    name: string,
    defaultDose?: string | null
  ): Medication {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    validateMedicationName(trimmed);

    const existing = this.db.getFirst<MedicationRow>(
      `SELECT * FROM medications
       WHERE LOWER(TRIM(name)) = LOWER(?)
       ORDER BY is_archived ASC, updated_at DESC
       LIMIT 1`,
      [trimmed]
    );

    if (existing) {
      if (existing.is_archived === 1) {
        return this.reactivateMedication(existing.id);
      }
      const dose = normalizeOptionalText(defaultDose);
      if (dose && !existing.default_dose) {
        return this.updateMedication(existing.id, { defaultDose: dose });
      }
      return mapMedication(existing);
    }

    return this.createMedication({ name: trimmed, defaultDose });
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
        ? normalizeOptionalText(patch.defaultDose)
        : existing.defaultDose;
    const unit =
      patch.unit !== undefined ? normalizeOptionalText(patch.unit) : existing.unit;
    const notes =
      patch.notes !== undefined ? normalizeOptionalText(patch.notes) : existing.notes;
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

  /** Restores an archived medication to the active quick-pick list. */
  reactivateMedication(id: string): Medication {
    return this.updateMedication(id, { isArchived: false });
  }

  createIntake(input: MedicationIntakeInput): MedicationIntake {
    const medication = this.getMedicationById(input.medicationId);
    if (!medication) {
      throw new StorageError(`Medication not found: ${input.medicationId}`);
    }

    if (input.effect != null) {
      validateMedicationEffect(input.effect);
    }

    const id = createId();
    const now = nowIsoUtc();
    const episodeId = input.episodeId ?? null;
    const effect = input.effect ?? null;
    const effectRatedAt =
      effect != null ? input.effectRatedAt ?? now : input.effectRatedAt ?? null;
    const snapshot =
      input.medicationNameSnapshot?.trim() || medication.name.trim();

    try {
      this.db.run(
        `INSERT INTO medication_intakes
          (id, episode_id, medication_id, medication_name_snapshot, taken_at,
           dose, unit, effect, effect_rated_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          episodeId,
          input.medicationId,
          snapshot,
          input.takenAt,
          normalizeOptionalText(input.dose),
          normalizeOptionalText(input.unit),
          effect,
          effectRatedAt,
          now,
          now,
        ]
      );
    } catch (err) {
      throw new StorageError('Failed to create medication intake', err);
    }

    return {
      id,
      episodeId,
      medicationId: input.medicationId,
      medicationNameSnapshot: snapshot,
      takenAt: input.takenAt,
      dose: normalizeOptionalText(input.dose),
      unit: normalizeOptionalText(input.unit),
      effect,
      effectRatedAt,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Creates or reuses a catalog medication, then records an episode intake.
   * Used by quick intake when the user enters a new drug name inline.
   */
  recordEpisodeIntake(input: {
    episodeId: string;
    medicationId?: string;
    medicationName?: string;
    defaultDose?: string | null;
    dose?: string | null;
    takenAt?: string;
  }): MedicationIntake {
    const medication =
      input.medicationId != null
        ? this.getMedicationById(input.medicationId)
        : input.medicationName
          ? this.getOrCreateMedication(
              input.medicationName,
              input.defaultDose ?? input.dose
            )
          : null;

    if (!medication) {
      throw new StorageError('Medication is required to record intake');
    }

    const dose =
      input.dose !== undefined
        ? input.dose
        : medication.defaultDose;

    return this.createIntake({
      medicationId: medication.id,
      episodeId: input.episodeId,
      takenAt: input.takenAt ?? nowIsoUtc(),
      dose,
      medicationNameSnapshot: medication.name,
    });
  }

  getIntakeById(id: string): MedicationIntake | null {
    const row = this.db.getFirst<IntakeRow>(
      'SELECT * FROM medication_intakes WHERE id = ?',
      [id]
    );
    return row ? mapIntake(row, this.getMedicationById(row.medication_id)) : null;
  }

  listIntakesForEpisode(episodeId: string): MedicationIntake[] {
    const rows = this.db.getAll<IntakeRow>(
      `SELECT * FROM medication_intakes
       WHERE episode_id = ?
       ORDER BY taken_at ASC`,
      [episodeId]
    );
    return rows.map((row) =>
      mapIntake(row, this.getMedicationById(row.medication_id))
    );
  }

  updateIntake(id: string, patch: MedicationIntakeUpdate): MedicationIntake {
    const existing = this.getIntakeById(id);
    if (!existing) {
      throw new StorageError(`Intake not found: ${id}`);
    }

    let medicationId = existing.medicationId;
    let medicationNameSnapshot = existing.medicationNameSnapshot;

    if (patch.medicationId && patch.medicationId !== existing.medicationId) {
      const medication = this.getMedicationById(patch.medicationId);
      if (!medication) {
        throw new StorageError(`Medication not found: ${patch.medicationId}`);
      }
      medicationId = medication.id;
      medicationNameSnapshot = medication.name;
    }

    const takenAt = patch.takenAt ?? existing.takenAt;
    const dose =
      patch.dose !== undefined ? normalizeOptionalText(patch.dose) : existing.dose;
    const unit =
      patch.unit !== undefined ? normalizeOptionalText(patch.unit) : existing.unit;

    let effect = existing.effect;
    let effectRatedAt = existing.effectRatedAt;
    if (patch.effect !== undefined) {
      if (patch.effect == null) {
        effect = null;
        effectRatedAt = null;
      } else {
        validateMedicationEffect(patch.effect);
        effect = patch.effect;
        effectRatedAt = patch.effectRatedAt ?? nowIsoUtc();
      }
    }

    const updatedAt = nowIsoUtc();

    try {
      this.db.run(
        `UPDATE medication_intakes
         SET medication_id = ?, medication_name_snapshot = ?, taken_at = ?,
             dose = ?, unit = ?, effect = ?, effect_rated_at = ?, updated_at = ?
         WHERE id = ?`,
        [
          medicationId,
          medicationNameSnapshot,
          takenAt,
          dose,
          unit,
          effect,
          effectRatedAt,
          updatedAt,
          id,
        ]
      );
    } catch (err) {
      throw new StorageError(`Failed to update intake ${id}`, err);
    }

    return {
      ...existing,
      medicationId,
      medicationNameSnapshot,
      takenAt,
      dose,
      unit,
      effect,
      effectRatedAt,
      updatedAt,
    };
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
    return this.updateIntake(intakeId, { effect, effectRatedAt });
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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function mapIntake(
  row: IntakeRow,
  medication: Medication | null
): MedicationIntake {
  const snapshot =
    row.medication_name_snapshot?.trim() ||
    medication?.name ||
    'Лекарство';

  return {
    id: row.id,
    episodeId: row.episode_id,
    medicationId: row.medication_id,
    medicationNameSnapshot: snapshot,
    takenAt: row.taken_at,
    dose: row.dose,
    unit: row.unit,
    effect: row.effect as MedicationEffect | null,
    effectRatedAt: row.effect_rated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}
