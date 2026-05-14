import { getDatabase } from './database';

/**
 * @returns {Promise<{ id: number, name: string, dosage: string, tablets_per_box: number, box_count: number, breakfast_tablets: number, lunch_tablets: number, dinner_tablets: number, created_at: number, updated_at: number, scheduleEntries: object[] }[]>}
 */
export async function listMedicationsWithSchedules() {
  const db = await getDatabase();
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
