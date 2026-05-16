import { getDatabase } from './database';

export const REMINDER_TYPES = {
  MEDICATION: 'medication',
  GLUCOSE: 'glucose',
};

export const REMINDER_MEAL_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  SNACK: 'snack',
  CUSTOM: 'custom',
};

export async function listCustomReminders() {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT id, label, reminder_type, meal_type, duration_minutes, enabled, use_clock, created_at, updated_at
     FROM custom_reminders
     ORDER BY updated_at DESC, created_at DESC`
  );
}

export async function insertCustomReminder(data) {
  const db = await getDatabase();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO custom_reminders
      (label, reminder_type, meal_type, duration_minutes, enabled, use_clock, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(data.label ?? '').trim(),
      String(data.reminder_type ?? REMINDER_TYPES.MEDICATION),
      String(data.meal_type ?? REMINDER_MEAL_TYPES.CUSTOM),
      Number(data.duration_minutes) || 0,
      data.enabled ? 1 : 0,
      data.use_clock ? 1 : 0,
      now,
      now,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateCustomReminder(id, data) {
  const db = await getDatabase();
  const now = Date.now();
  await db.runAsync(
    `UPDATE custom_reminders
     SET label = ?, reminder_type = ?, meal_type = ?, duration_minutes = ?, enabled = ?, use_clock = ?, updated_at = ?
     WHERE id = ?`,
    [
      String(data.label ?? '').trim(),
      String(data.reminder_type ?? REMINDER_TYPES.MEDICATION),
      String(data.meal_type ?? REMINDER_MEAL_TYPES.CUSTOM),
      Number(data.duration_minutes) || 0,
      data.enabled ? 1 : 0,
      data.use_clock ? 1 : 0,
      now,
      id,
    ]
  );
}

export async function deleteCustomReminder(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM custom_reminders WHERE id = ?', [id]);
}

export async function getCustomReminder(id) {
  const db = await getDatabase();
  return db.getFirstAsync(
    `SELECT id, label, reminder_type, meal_type, duration_minutes, enabled, use_clock, created_at, updated_at
     FROM custom_reminders
     WHERE id = ?`,
    [id]
  );
}
