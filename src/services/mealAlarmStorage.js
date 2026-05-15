import AsyncStorage from '@react-native-async-storage/async-storage';

export const MEAL_ALARM_STORAGE_KEY = '@diatrack/meal_alarm_v1';

/**
 * @typedef {{ mealStartMs: number, medicineAtMs: number, glucoseAtMs: number, mealType?: string, mealLabel?: string, intakeEventId?: number }} MealAlarmSession
 */

/** @returns {Promise<MealAlarmSession | null>} */
export async function loadMealAlarmSession() {
  const raw = await AsyncStorage.getItem(MEAL_ALARM_STORAGE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (
      typeof p.mealStartMs !== 'number' ||
      typeof p.medicineAtMs !== 'number' ||
      typeof p.glucoseAtMs !== 'number'
    ) {
      return null;
    }
    return {
      mealStartMs: p.mealStartMs,
      medicineAtMs: p.medicineAtMs,
      glucoseAtMs: p.glucoseAtMs,
      mealType: typeof p.mealType === 'string' ? p.mealType : undefined,
      mealLabel: typeof p.mealLabel === 'string' ? p.mealLabel : undefined,
      intakeEventId: typeof p.intakeEventId === 'number' ? p.intakeEventId : undefined,
    };
  } catch {
    return null;
  }
}

/** @param {MealAlarmSession} session */
export async function saveMealAlarmSession(session) {
  await AsyncStorage.setItem(MEAL_ALARM_STORAGE_KEY, JSON.stringify(session));
}

export async function clearMealAlarmSession() {
  await AsyncStorage.removeItem(MEAL_ALARM_STORAGE_KEY);
}
