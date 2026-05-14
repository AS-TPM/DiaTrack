import * as SQLite from 'expo-sqlite';

const DB_NAME = 'diatrack.db';

let dbPromise = null;

const DDL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS glucose_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    value_mgdl REAL NOT NULL,
    meal_context TEXT NOT NULL,
    recorded_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_glucose_readings_recorded_at
    ON glucose_readings (recorded_at);

  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL DEFAULT '',
    tablets_per_box REAL NOT NULL,
    box_count REAL NOT NULL,
    breakfast_tablets REAL NOT NULL DEFAULT 0,
    lunch_tablets REAL NOT NULL DEFAULT 0,
    dinner_tablets REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS medication_schedule_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    medication_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    tablet_count REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_med_schedule_med
    ON medication_schedule_entries (medication_id);
`;

/** Current bundled schema revision (increment when adding migrations below). */
const SCHEMA_VERSION = 1;

async function applyMigrations(db) {
  const row = await db.getFirstAsync('PRAGMA user_version');
  const rawV = row && typeof row === 'object' ? row.user_version : undefined;
  const v = rawV != null && Number.isFinite(Number(rawV)) ? Number(rawV) : 0;

  await db.execAsync(DDL);

  if (v < SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

/** Opens the app database, applies idempotent schema, and re-enables FK checks. */
export function getDatabase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await applyMigrations(db);
      return db;
    })();
  }
  return dbPromise.then(async (db) => {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return db;
  });
}
