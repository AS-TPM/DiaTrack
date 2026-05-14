/** Low-stock when fewer than this many days of supply remain. */
export const LOW_STOCK_DAYS = 7;

/** Bar fills relative to this many days of supply (cap at 100%). */
export const SUPPLY_BAR_TARGET_DAYS = 30;

/**
 * @typedef {{ id?: number, label: string, tablet_count: number, sort_order?: number }} ScheduleEntry
 * @typedef {{ id?: number, name: string, dosage: string, tablets_per_box: number, box_count: number, breakfast_tablets: number, lunch_tablets: number, dinner_tablets: number }} MedicationRow
 */

/**
 * @param {MedicationRow} med
 * @param {ScheduleEntry[]} scheduleEntries
 */
export function computeMedicationMetrics(med, scheduleEntries) {
  const tabletsPerBox = Math.max(0, Number(med.tablets_per_box) || 0);
  const boxCount = Math.max(0, Number(med.box_count) || 0);
  const totalTablets = tabletsPerBox * boxCount;

  const breakfast = Math.max(0, Number(med.breakfast_tablets) || 0);
  const lunch = Math.max(0, Number(med.lunch_tablets) || 0);
  const dinner = Math.max(0, Number(med.dinner_tablets) || 0);
  const extraDaily = (scheduleEntries ?? []).reduce(
    (sum, e) => sum + Math.max(0, Number(e.tablet_count) || 0),
    0
  );
  const tabletsPerDay = breakfast + lunch + dinner + extraDaily;

  const daysRemaining =
    tabletsPerDay > 0 && Number.isFinite(totalTablets)
      ? totalTablets / tabletsPerDay
      : null;

  const supplyBarPercent =
    daysRemaining == null || !Number.isFinite(daysRemaining)
      ? 0
      : Math.min(100, (daysRemaining / SUPPLY_BAR_TARGET_DAYS) * 100);

  const remainingPercent =
    daysRemaining == null || !Number.isFinite(daysRemaining)
      ? 0
      : Math.min(100, (daysRemaining / SUPPLY_BAR_TARGET_DAYS) * 100);

  const isLowStock =
    tabletsPerDay > 0 &&
    daysRemaining != null &&
    Number.isFinite(daysRemaining) &&
    daysRemaining < LOW_STOCK_DAYS;

  const hasSchedule =
    breakfast > 0 ||
    lunch > 0 ||
    dinner > 0 ||
    (scheduleEntries?.length ?? 0) > 0;

  return {
    totalTablets,
    tabletsPerDay,
    breakfast,
    lunch,
    dinner,
    extraDaily,
    daysRemaining,
    supplyBarPercent,
    remainingPercent,
    isLowStock,
    hasSchedule,
  };
}

/**
 * @param {{ med: MedicationRow, scheduleEntries: ScheduleEntry[], metrics: ReturnType<typeof computeMedicationMetrics> }[]} rows
 */
export function summarizeInventory(rows) {
  if (!rows.length) {
    return {
      medicationCount: 0,
      lowStockCount: 0,
      totalTabletsOnHand: 0,
      totalDailyTablets: 0,
      tightest: null,
    };
  }

  let lowStockCount = 0;
  let totalTabletsOnHand = 0;
  let totalDailyTablets = 0;
  let tightest = null;

  for (const r of rows) {
    const { metrics, med } = r;
    totalTabletsOnHand += metrics.totalTablets;
    totalDailyTablets += metrics.tabletsPerDay;
    if (metrics.isLowStock) lowStockCount += 1;

    if (metrics.tabletsPerDay > 0 && metrics.daysRemaining != null && Number.isFinite(metrics.daysRemaining)) {
      if (
        tightest == null ||
        metrics.daysRemaining < tightest.metrics.daysRemaining
      ) {
        tightest = { med, metrics };
      }
    }
  }

  return {
    medicationCount: rows.length,
    lowStockCount,
    totalTabletsOnHand,
    totalDailyTablets,
    tightest,
  };
}

export function formatDaysRemaining(days) {
  if (days == null || !Number.isFinite(days)) return '—';
  if (days >= 100) return `${Math.floor(days)}+ days`;
  if (days >= 1) return `~${days.toFixed(1)} days`;
  return '<1 day';
}
