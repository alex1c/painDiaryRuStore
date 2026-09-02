/** Stable identifier for pain-diary JSON backup files. */
export const BACKUP_FORMAT = 'pain-diary-backup';

/** Backup schema version supported by this app release. */
export const SUPPORTED_BACKUP_VERSION = 1;

/** Reject backups larger than this to avoid accidental DoS via import. */
export const MAX_BACKUP_JSON_BYTES = 50 * 1024 * 1024;

/** Per-table row ceiling during validation (reasonable local diary scale). */
export const MAX_ROWS_PER_TABLE = 100_000;

/** MIME type used when sharing backup JSON via the native sheet. */
export const BACKUP_MIME_TYPE = 'application/json';
