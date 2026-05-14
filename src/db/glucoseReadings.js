import { getDatabase } from './database';

/**
 * @param {{ valueMgdl: number, mealContext: string, recordedAt?: number }} row
 */
export async function insertGlucoseReading({ valueMgdl, mealContext, recordedAt }) {
  const db = await getDatabase();
  const ts = recordedAt ?? Date.now();
  const result = await db.runAsync(
    'INSERT INTO glucose_readings (value_mgdl, meal_context, recorded_at) VALUES (?, ?, ?)',
    [valueMgdl, mealContext, ts]
  );
  return result.lastInsertRowId;
}

/**
 * @param {number} [limit=100]
 * @returns {Promise<{ id: number, value_mgdl: number, meal_context: string, recorded_at: number }[]>}
 */
export async function listGlucoseReadings(limit = 100) {
  const db = await getDatabase();
  return db.getAllAsync(
    'SELECT id, value_mgdl, meal_context, recorded_at FROM glucose_readings ORDER BY recorded_at DESC LIMIT ?',
    [limit]
  );
}

/** Local calendar day bounds for `date` (default: today). */
export function getLocalDayBoundsMs(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

/** Latest reading by `recorded_at` (SQLite). */
export async function getLatestGlucoseReading() {
  const db = await getDatabase();
  return db.getFirstAsync(
    'SELECT id, value_mgdl, meal_context, recorded_at FROM glucose_readings ORDER BY recorded_at DESC LIMIT 1'
  );
}

/**
 * Aggregates for readings with `recorded_at` in [startMs, endMs).
 * @returns {Promise<{ cnt: number, avg_v: number | null, min_v: number | null, max_v: number | null } | null>}
 */
export async function getGlucoseAggregateInRange(startMs, endMs) {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS cnt,
            AVG(value_mgdl) AS avg_v,
            MIN(value_mgdl) AS min_v,
            MAX(value_mgdl) AS max_v
     FROM glucose_readings
     WHERE recorded_at >= ? AND recorded_at < ?`,
    [startMs, endMs]
  );
  return row;
}

/** Today's aggregate in local timezone. */
export async function getTodayGlucoseAggregate() {
  const { startMs, endMs } = getLocalDayBoundsMs();
  return getGlucoseAggregateInRange(startMs, endMs);
}

/**
 * Daily buckets for trend chart (local date). `sinceMs` inclusive.
 * @returns {Promise<{ day: string, avg_v: number, min_v: number, max_v: number, cnt: number }[]>}
 */
export async function getGlucoseDailyTrendBuckets(sinceMs) {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    `SELECT date(recorded_at / 1000, 'unixepoch', 'localtime') AS day,
            AVG(value_mgdl) AS avg_v,
            MIN(value_mgdl) AS min_v,
            MAX(value_mgdl) AS max_v,
            COUNT(*) AS cnt
     FROM glucose_readings
     WHERE recorded_at >= ?
     GROUP BY day
     ORDER BY day ASC`,
    [sinceMs]
  );
  return rows ?? [];
}

/**
 * @param {{ value_mgdl: number, recorded_at: number, meal_context?: string }[]} readings
 * @param {{ skipDuplicates?: boolean }} [opts]
 */
export async function insertGlucoseReadingsBatch(readings, opts = {}) {
  const { skipDuplicates = true } = opts;
  const db = await getDatabase();
  let imported = 0;
  let skipped = 0;
  await db.withTransactionAsync(async () => {
    for (const r of readings) {
      const meal = r.meal_context ?? 'imported';
      if (skipDuplicates) {
        const dup = await db.getFirstAsync(
          'SELECT 1 AS x FROM glucose_readings WHERE recorded_at = ? AND value_mgdl = ? LIMIT 1',
          [r.recorded_at, r.value_mgdl]
        );
        if (dup) {
          skipped += 1;
          continue;
        }
      }
      await db.runAsync(
        'INSERT INTO glucose_readings (value_mgdl, meal_context, recorded_at) VALUES (?, ?, ?)',
        [r.value_mgdl, meal, r.recorded_at]
      );
      imported += 1;
    }
  });
  return { imported, skipped };
}
