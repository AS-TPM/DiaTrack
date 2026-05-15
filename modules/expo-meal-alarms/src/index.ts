import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeModule = {
  scheduleFromMealStart: (mealStartMs: number) => {
    ok: boolean;
    medicineAtMs: number;
    glucoseAtMs: number;
    canScheduleExactAlarms: boolean;
    allExactAlarms: boolean;
    alarmClockExactSupported: boolean;
    postNotificationsGranted: boolean;
    batteryOptimizationIgnored: boolean;
    manufacturer: string;
  };
  scheduleAtTimes?: (
    mealStartMs: number,
    medicineAtMs: number,
    glucoseAtMs: number
  ) => {
    ok: boolean;
    medicineAtMs: number;
    glucoseAtMs: number;
    canScheduleExactAlarms: boolean;
    allExactAlarms: boolean;
    alarmClockExactSupported: boolean;
    postNotificationsGranted: boolean;
    batteryOptimizationIgnored: boolean;
    manufacturer: string;
  };
  cancelAll: () => void;
  canScheduleExactAlarms: () => boolean;
  openExactAlarmSettings: () => void;
  getExactAlarmStatus: () => {
    canScheduleExactAlarms: boolean;
    sdkInt: number;
    hasNativeModule: boolean;
    alarmClockExactSupported: boolean;
    postNotificationsGranted: boolean;
    batteryOptimizationIgnored: boolean;
    manufacturer: string;
  };
  isIgnoringBatteryOptimizations: () => boolean;
  openBatteryOptimizationSettings: () => void;
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
      alarmClockExactSupported: false,
      postNotificationsGranted: false,
      batteryOptimizationIgnored: true,
      manufacturer: '',
    };
  }
  return Native.scheduleFromMealStart(mealStartMs);
}

export function scheduleMealAlarmsAtTimesNative(
  mealStartMs: number,
  medicineAtMs: number,
  glucoseAtMs: number
) {
  if (!Native) {
    return {
      ok: false,
      medicineAtMs,
      glucoseAtMs,
      canScheduleExactAlarms: false,
      allExactAlarms: false,
      alarmClockExactSupported: false,
      postNotificationsGranted: false,
      batteryOptimizationIgnored: true,
      manufacturer: '',
    };
  }
  if (Native.scheduleAtTimes) {
    return Native.scheduleAtTimes(mealStartMs, medicineAtMs, glucoseAtMs);
  }
  const legacy = Native.scheduleFromMealStart(mealStartMs);
  return {
    ...legacy,
    medicineAtMs,
    glucoseAtMs,
  };
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
    return {
      canScheduleExactAlarms: true,
      sdkInt: 0,
      hasNativeModule: false,
      alarmClockExactSupported: false,
      postNotificationsGranted: false,
      batteryOptimizationIgnored: true,
      manufacturer: '',
    };
  }
  return Native.getExactAlarmStatus();
}

export function isIgnoringBatteryOptimizationsNative(): boolean {
  if (!Native?.isIgnoringBatteryOptimizations) return true;
  return Native.isIgnoringBatteryOptimizations();
}

export function openBatteryOptimizationSettingsNative() {
  Native?.openBatteryOptimizationSettings?.();
}
