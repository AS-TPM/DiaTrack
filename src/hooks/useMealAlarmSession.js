import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  clearMealAlarmSession,
  loadMealAlarmSession,
  saveMealAlarmSession,
} from '../services/mealAlarmStorage';

const MED_MS = 30 * 60 * 1000;
const GLU_MS = 2 * 60 * 60 * 1000;

function formatRemaining(ms) {
  if (ms <= 0) return 'Due now';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function useMealAlarmSession() {
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    const s = await loadMealAlarmSession();
    setSession(s);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reload();
      }
    });
    return () => sub.remove();
  }, [reload]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const medicineLabel = useMemo(
    () => (session ? formatRemaining(session.medicineAtMs - now) : '—'),
    [session, now]
  );
  const glucoseLabel = useMemo(
    () => (session ? formatRemaining(session.glucoseAtMs - now) : '—'),
    [session, now]
  );

  const startMeal = useCallback(async (meal = {}) => {
    const mealStartMs = Date.now();
    const medicineAtMs = mealStartMs + MED_MS;
    const glucoseAtMs = mealStartMs + GLU_MS;
    const mealType = meal.mealType ?? 'custom';
    const mealLabel = meal.mealLabel ?? 'Meal';
    const intakeEventId = meal.intakeEventId;

    const next = {
      mealStartMs,
      medicineAtMs,
      glucoseAtMs,
      mealType,
      mealLabel,
      intakeEventId,
    };

    await saveMealAlarmSession(next);
    setSession(next);
  }, []);

  const clearTimers = useCallback(async () => {
    await clearMealAlarmSession();
    setSession(null);
  }, []);

  return {
    session,
    medicineLabel,
    glucoseLabel,
    startMeal,
    clearTimers,
    reload,
  };
}
