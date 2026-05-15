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

  CREATE TABLE IF NOT EXISTS medication_intake_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    meal_type TEXT NOT NULL,
    meal_label TEXT NOT NULL,
    meal_started_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    reverted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_med_intake_events_created
    ON medication_intake_events (created_at);

  CREATE TABLE IF NOT EXISTS medication_intake_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    event_id INTEGER NOT NULL,
    medication_id INTEGER,
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL DEFAULT '',
    scheduled_tablets REAL NOT NULL,
    tablets_per_box REAL NOT NULL,
    box_count_before REAL NOT NULL,
    box_count_after REAL NOT NULL,
    created_at INTEGER NOT NULL,
    reverted_at INTEGER,
    FOREIGN KEY (event_id) REFERENCES medication_intake_events(id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_med_intake_items_event
    ON medication_intake_items (event_id);
    CREATE TABLE IF NOT EXISTS meal_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_type TEXT,
  meal_label TEXT,
  started_at INTEGER,
  glucose_check_time INTEGER,
  medication_count INTEGER,
  notes TEXT
);
`;

/** Current bundled schema revision (increment when adding migrations below). */
const SCHEMA_VERSION = 3;

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
