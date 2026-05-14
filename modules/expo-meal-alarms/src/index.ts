import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeModule = {
  scheduleFromMealStart: (mealStartMs: number) => {
    ok: boolean;
    medicineAtMs: number;
    glucoseAtMs: number;
    canScheduleExactAlarms: boolean;
    allExactAlarms: boolean;
  };
  cancelAll: () => void;
  canScheduleExactAlarms: () => boolean;
  openExactAlarmSettings: () => void;
  getExactAlarmStatus: () => {
    canScheduleExactAlarms: boolean;
    sdkInt: number;
    hasNativeModule: boolean;
  };
};

const Native = requireOptionalNativeModule<NativeModule>('ExpoMealAlarms');

export function isMealAlarmNativeAvailable(): boolean {
  return Platform.OS === 'android' && Native != null;
}

export function scheduleMealAlarmsFromNative(mealStartMs: number) {
  if (!Native) {
    return {
      ok: false,
      medicineAtMs: mealStartMs + 30 * 60 * 1000,
      glucoseAtMs: mealStartMs + 2 * 60 * 60 * 1000,
      canScheduleExactAlarms: false,
      allExactAlarms: false,
    };
  }
  return Native.scheduleFromMealStart(mealStartMs);
}

export function cancelMealAlarmsNative() {
  Native?.cancelAll?.();
}

export function canScheduleExactAlarmsNative(): boolean {
  if (!Native) return false;
  return Native.canScheduleExactAlarms();
}

export function openExactAlarmSettingsNative() {
  Native?.openExactAlarmSettings?.();
}

/** Android 12+ exact alarm capability (requires manifest permissions + OEM policy). */
export function getExactAlarmStatusNative() {
  if (!Native?.getExactAlarmStatus) {
    return { canScheduleExactAlarms: true, sdkInt: 0, hasNativeModule: false };
  }
  return Native.getExactAlarmStatus();
}
