import { getDatabase } from './database';

export const MEAL_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  SNACK: 'snack',
  CUSTOM: 'custom',
};

const MEAL_COLUMN_BY_TYPE = {
  [MEAL_TYPES.BREAKFAST]: 'breakfast_tablets',
  [MEAL_TYPES.LUNCH]: 'lunch_tablets',
  [MEAL_TYPES.DINNER]: 'dinner_tablets',
};

function normalizeLabel(value) {
  return String(value ?? '').trim().toLowerCase();
}

function doseForMeal(med, mealType, mealLabel) {
  const column = MEAL_COLUMN_BY_TYPE[mealType];
  if (column) {
    return Math.max(0, Number(med[column]) || 0);
  }

  const wanted = normalizeLabel(mealType === MEAL_TYPES.CUSTOM ? mealLabel : mealType);
  if (!wanted) return 0;

  return (med.scheduleEntries ?? []).reduce((sum, entry) => {
    if (normalizeLabel(entry.label) !== wanted) return sum;
    return sum + Math.max(0, Number(entry.tablet_count) || 0);
  }, 0);
}

async function listMedicationsWithSchedulesFromDb(db) {
  const meds = await db.getAllAsync(
    'SELECT id, name, dosage, tablets_per_box, box_count, breakfast_tablets, lunch_tablets, dinner_tablets, created_at, updated_at FROM medications ORDER BY name COLLATE NOCASE ASC'
  );
  const entries = await db.getAllAsync(
    'SELECT id, medication_id, sort_order, label, tablet_count FROM medication_schedule_entries ORDER BY medication_id ASC, sort_order ASC, id ASC'
  );
  const byMed = new Map();
  for (const e of entries) {
    const list = byMed.get(e.medication_id) ?? [];
    list.push(e);
    byMed.set(e.medication_id, list);
  }
  return meds.map((m) => ({
    ...m,
    scheduleEntries: byMed.get(m.id) ?? [],
  }));
}

/**
 * @returns {Promise<{ id: number, name: string, dosage: string, tablets_per_box: number, box_count: number, breakfast_tablets: number, lunch_tablets: number, dinner_tablets: number, created_at: number, updated_at: number, scheduleEntries: object[] }[]>}
 */
export async function listMedicationsWithSchedules() {
  const db = await getDatabase();
  return listMedicationsWithSchedulesFromDb(db);
}

/**
 * @param {object} data
 * @param {{ label: string, tablet_count: number }[]} extraSlots
 */
export async function insertMedication(data, extraSlots = []) {
  const db = await getDatabase();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO medications (name, dosage, tablets_per_box, box_count, breakfast_tablets, lunch_tablets, dinner_tablets, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name.trim(),
      (data.dosage ?? '').trim(),
      data.tablets_per_box,
      data.box_count,
      data.breakfast_tablets ?? 0,
      data.lunch_tablets ?? 0,
      data.dinner_tablets ?? 0,
      now,
      now,
    ]
  );
  const id = result.lastInsertRowId;
  let order = 0;
  for (const slot of extraSlots) {
    const label = (slot.label ?? '').trim();
    if (!label && !(Number(slot.tablet_count) > 0)) continue;
    await db.runAsync(
      'INSERT INTO medication_schedule_entries (medication_id, sort_order, label, tablet_count) VALUES (?, ?, ?, ?)',
      [id, order++, label || 'Dose', Number(slot.tablet_count) || 0]
    );
  }
  return id;
}

/**
 * @param {number} id
 * @param {object} data
 * @param {{ label: string, tablet_count: number }[]} extraSlots
 */
export async function updateMedication(id, data, extraSlots = []) {
  const db = await getDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE medications SET name = ?, dosage = ?, tablets_per_box = ?, box_count = ?, breakfast_tablets = ?, lunch_tablets = ?, dinner_tablets = ?, updated_at = ?
       WHERE id = ?`,
      [
        data.name.trim(),
        (data.dosage ?? '').trim(),
        data.tablets_per_box,
        data.box_count,
        data.breakfast_tablets ?? 0,
        data.lunch_tablets ?? 0,
        data.dinner_tablets ?? 0,
        now,
        id,
      ]
    );
    await db.runAsync('DELETE FROM medication_schedule_entries WHERE medication_id = ?', [id]);
    let order = 0;
    for (const slot of extraSlots) {
      const label = (slot.label ?? '').trim();
      if (!label && !(Number(slot.tablet_count) > 0)) continue;
      await db.runAsync(
        'INSERT INTO medication_schedule_entries (medication_id, sort_order, label, tablet_count) VALUES (?, ?, ?, ?)',
        [id, order++, label || 'Dose', Number(slot.tablet_count) || 0]
      );
    }
  });
}

/**
 * @param {number} id
 */
export async function deleteMedication(id) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM medications WHERE id = ?', [id]);
}

/**
 * Logs a meal medication intake event and deducts only medications scheduled for that meal.
 *
 * Breakfast/lunch/dinner use the built-in schedule columns. Snack and custom meals
 * match custom schedule labels, so a custom slot named "Snack" or "Bedtime" can be
 * deducted when that meal label is selected.
 *
 * @param {{ mealType: string, mealLabel: string, mealStartedAt?: number }} input
 * @returns {Promise<{ eventId: number, deductedCount: number, totalTablets: number, items: object[] }>}
 */
export async function logMealMedicationIntake(input) {
  const db = await getDatabase();
  const mealType = normalizeLabel(input.mealType);
  const mealLabel = String(input.mealLabel ?? input.mealType ?? '').trim();
  const mealStartedAt = Number(input.mealStartedAt) || Date.now();
  const createdAt = Date.now();
  let result = { eventId: null, deductedCount: 0, totalTablets: 0, items: [] };

  await db.withTransactionAsync(async () => {
    const event = await db.runAsync(
      `INSERT INTO medication_intake_events (meal_type, meal_label, meal_started_at, created_at)
       VALUES (?, ?, ?, ?)`,
      [mealType, mealLabel || mealType, mealStartedAt, createdAt]
    );
    const eventId = event.lastInsertRowId;
    const meds = await listMedicationsWithSchedulesFromDb(db);
    const items = [];

    for (const med of meds) {
      const scheduledTablets = doseForMeal(med, mealType, mealLabel);
      if (!(scheduledTablets > 0)) continue;

      const tabletsPerBox = Math.max(0, Number(med.tablets_per_box) || 0);
      const boxCountBefore = Math.max(0, Number(med.box_count) || 0);
      const tabletsBefore = tabletsPerBox * boxCountBefore;
      const tabletsAfter = Math.max(0, tabletsBefore - scheduledTablets);
      const boxCountAfter = tabletsPerBox > 0 ? tabletsAfter / tabletsPerBox : boxCountBefore;

      await db.runAsync(
        `UPDATE medications
         SET box_count = ?, updated_at = ?
         WHERE id = ?`,
        [boxCountAfter, createdAt, med.id]
      );
      await db.runAsync(
        `INSERT INTO medication_intake_items
          (event_id, medication_id, medication_name, dosage, scheduled_tablets, tablets_per_box, box_count_before, box_count_after, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          med.id,
          med.name,
          med.dosage ?? '',
          scheduledTablets,
          tabletsPerBox,
          boxCountBefore,
          boxCountAfter,
          createdAt,
        ]
      );

      items.push({
        medicationId: med.id,
        medicationName: med.name,
        dosage: med.dosage ?? '',
        scheduledTablets,
        boxCountBefore,
        boxCountAfter,
      });
    }

    result = {
      eventId,
      deductedCount: items.length,
      totalTablets: items.reduce((sum, item) => sum + item.scheduledTablets, 0),
      items,
    };
  });

  return result;
}

/**
 * Restores medication stock by adding each logged deduction back to the current stock.
 * This is intentionally separate from the meal-start UI so a later history screen can call it.
 *
 * @param {number} eventId
 */
export async function revertMedicationIntakeEvent(eventId) {
  const db = await getDatabase();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const items = await db.getAllAsync(
      `SELECT id, medication_id, scheduled_tablets, tablets_per_box
       FROM medication_intake_items
       WHERE event_id = ? AND reverted_at IS NULL`,
      [eventId]
    );
    for (const item of items) {
      if (item.medication_id != null) {
        const med = await db.getFirstAsync(
          'SELECT box_count FROM medications WHERE id = ?',
          [item.medication_id]
        );
        const tabletsPerBox = Math.max(0, Number(item.tablets_per_box) || 0);
        const currentBoxes = Math.max(0, Number(med?.box_count) || 0);
        const restoredBoxes =
          tabletsPerBox > 0
            ? currentBoxes + Math.max(0, Number(item.scheduled_tablets) || 0) / tabletsPerBox
            : currentBoxes;
        await db.runAsync(
          'UPDATE medications SET box_count = ?, updated_at = ? WHERE id = ?',
          [restoredBoxes, now, item.medication_id]
        );
      }
      await db.runAsync('UPDATE medication_intake_items SET reverted_at = ? WHERE id = ?', [
        now,
        item.id,
      ]);
    }
    await db.runAsync('UPDATE medication_intake_events SET reverted_at = ? WHERE id = ?', [
      now,
      eventId,
    ]);
  });
}
