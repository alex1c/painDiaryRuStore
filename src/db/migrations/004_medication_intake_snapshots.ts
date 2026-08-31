/**
 * Migration 004 — medication name snapshot + intake updated_at for history.
 * Non-destructive; backfills existing intake rows from the medications catalog.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration004MedicationIntakeSnapshots: Migration = {
	version: 4,
	name: '004_medication_intake_snapshots',

	up(db: SqlDatabase): void {
		db.exec(`
			ALTER TABLE medication_intakes ADD COLUMN medication_name_snapshot TEXT;
		`);

		db.exec(`
			ALTER TABLE medication_intakes ADD COLUMN updated_at TEXT;
		`);

		db.exec(`
			UPDATE medication_intakes
			SET medication_name_snapshot = (
				SELECT name FROM medications WHERE medications.id = medication_intakes.medication_id
			)
			WHERE medication_name_snapshot IS NULL;
		`);

		db.exec(`
			UPDATE medication_intakes
			SET updated_at = created_at
			WHERE updated_at IS NULL;
		`);
	},
};
