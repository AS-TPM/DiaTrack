import { getDatabase } from './database';
export async function addMealLog(log) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO meal_logs
    (
      meal_type,
      meal_label,
      started_at,
      glucose_check_time,
      medication_count,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      log.meal_type,
      log.meal_label,
      log.started_at,
      log.glucose_check_time,
      log.medication_count,
      log.notes || '',
    ]
  );
}

export async function getMealLogs() {
  const db = await getDatabase();

  return await db.getAllAsync(
    `SELECT * FROM meal_logs ORDER BY started_at DESC`
  );
}
export async function restoreMealLog(log) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO meal_logs
    (
      id,
      meal_type,
      meal_label,
      started_at,
      glucose_check_time,
      medication_count,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.meal_type,
      log.meal_label,
      log.started_at,
      log.glucose_check_time,
      log.medication_count,
      log.notes || '',
    ]
  );
}
export async function deleteMealLog(id) {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM meal_logs WHERE id = ?`,
    [id]
  );
}