import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  cancelMealAlarmsNative,
  getExactAlarmStatusNative,
  isMealAlarmNativeAvailable,
  openExactAlarmSettingsNative,
  scheduleMealAlarmsFromNative,
} from 'expo-meal-alarms';
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

async function ensureAndroidNotificationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export function useMealAlarmSession() {
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [exactStatus, setExactStatus] = useState(() =>
    Platform.OS === 'android' ? getExactAlarmStatusNative() : null
  );

  const refreshExactStatus = useCallback(() => {
    if (Platform.OS === 'android' && isMealAlarmNativeAvailable()) {
      setExactStatus(getExactAlarmStatusNative());
    }
  }, []);

  const reload = useCallback(async () => {
    const s = await loadMealAlarmSession();
    setSession(s);
    refreshExactStatus();
    if (s && Platform.OS === 'android' && isMealAlarmNativeAvailable()) {
      try {
        scheduleMealAlarmsFromNative(s.mealStartMs);
      } catch (e) {
        console.warn('Meal alarm resync', e);
      }
    }
  }, [refreshExactStatus]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reload();
        refreshExactStatus();
      }
    });
    return () => sub.remove();
  }, [reload, refreshExactStatus]);

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

  const exactAlarmBlocked =
    Platform.OS === 'android' &&
    isMealAlarmNativeAvailable() &&
    exactStatus?.hasNativeModule &&
    exactStatus.canScheduleExactAlarms === false;

  const startMeal = useCallback(async () => {
    const mealStartMs = Date.now();
    const medicineAtMs = mealStartMs + MED_MS;
    const glucoseAtMs = mealStartMs + GLU_MS;

    await ensureAndroidNotificationPermission();
    refreshExactStatus();

    const next = { mealStartMs, medicineAtMs, glucoseAtMs };
    await saveMealAlarmSession(next);
    setSession(next);

    if (Platform.OS === 'android' && isMealAlarmNativeAvailable()) {
      try {
        const res = scheduleMealAlarmsFromNative(mealStartMs);
        refreshExactStatus();
        if (!res.canScheduleExactAlarms) {
          Alert.alert(
            'Exact alarms disabled',
            'Android is blocking exact alarms for DiaTrack. Open settings and allow “Alarms & reminders” (or “Schedule exact alarms”) so medication and glucose timers fire on time when the app is closed.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open settings', onPress: () => openExactAlarmSettingsNative() },
            ]
          );
        } else if (res.allExactAlarms === false) {
          Alert.alert(
            'Alarms scheduled (reduced accuracy)',
            'Exact clock alarms were denied once; backup scheduling was used. They may be a few minutes late. Grant exact alarm permission for best results.',
            [
              { text: 'OK', style: 'cancel' },
              { text: 'Permission', onPress: () => openExactAlarmSettingsNative() },
            ]
          );
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Alarm scheduling failed', String(e?.message ?? e));
      }
    }
  }, [refreshExactStatus]);

  const clearTimers = useCallback(async () => {
    await clearMealAlarmSession();
    cancelMealAlarmsNative();
    setSession(null);
  }, []);

  return {
    session,
    medicineLabel,
    glucoseLabel,
    startMeal,
    clearTimers,
    reload,
    nativeAlarmsAvailable: Platform.OS === 'android' && isMealAlarmNativeAvailable(),
    openExactAlarmSettings: openExactAlarmSettingsNative,
    exactAlarmBlocked,
    refreshExactAlarmStatus: refreshExactStatus,
  };
}
