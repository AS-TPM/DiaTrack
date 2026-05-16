import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert, Linking } from 'react-native';

/**
 * Attempts to launch the Android/Samsung Clock timer with a preset duration.
 * Supports multiple Android clock apps and gracefully falls back if unavailable.
 *
 * @param {number} durationSeconds - Timer duration in seconds (default: 1800 = 30 min)
 * @param {string} label - Timer label/message (default: 'Meal Timer')
 * @returns {Promise<boolean>} - true if timer launched successfully, false otherwise
 */
export async function launchAndroidTimer(durationSeconds = 1800, label = 'Meal Timer') {
  if (Platform.OS !== 'android') {
    console.warn('Timer launcher: Not on Android platform');
    return false;
  }

  console.log('launchAndroidTimer start', { durationSeconds, label });

  try {
    await launchSetTimerIntent(durationSeconds, label);
    console.log('SET_TIMER intent succeeded');
    return true;
  } catch (primaryError) {
    console.warn('SET_TIMER intent failed:', primaryError);

    try {
      await launchSamsungTimer(durationSeconds, label);
      console.log('Samsung timer fallback succeeded');
      return true;
    } catch (samsungError) {
      console.warn('Samsung Timer fallback failed:', samsungError);

      try {
        await launchAlternativeClockApps(durationSeconds, label);
        console.log('Alternative clock app fallback succeeded');
        return true;
      } catch (altError) {
        console.warn('Alternative clock apps fallback failed:', altError);

        try {
          await launchTimerViaLinking(durationSeconds, label);
          console.log('Linking intent fallback succeeded');
          return true;
        } catch (linkingError) {
          console.warn('Linking fallback failed:', linkingError);
          showTimerUnavailableAlert();
          return false;
        }
      }
    }
  }
}

async function launchSetTimerIntent(durationSeconds, label) {
  return IntentLauncher.startActivityAsync('android.intent.action.SET_TIMER', {
    extra: {
      'android.intent.extra.alarm.LENGTH': durationSeconds,
      'android.intent.extra.alarm.MESSAGE': label,
      'android.intent.extra.alarm.SKIP_UI': false,
    },
    flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
  });
}

async function launchSamsungTimer(durationSeconds, label) {
  const samsungPackages = [
    'com.samsung.android.app.clockwidget',
    'com.samsung.android.seclock',
    'com.samsung.clock',
  ];

  for (const packageName of samsungPackages) {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SET_TIMER', {
        extra: {
          'android.intent.extra.alarm.LENGTH': durationSeconds,
          'android.intent.extra.alarm.MESSAGE': label,
          'android.intent.extra.alarm.SKIP_UI': false,
        },
        packageName,
        flags: 268435456,
      });
      console.log(`Samsung timer launched via package ${packageName}`);
      return;
    } catch (e) {
      console.warn(`Samsung package ${packageName} failed`, e);
    }
  }

  throw new Error('Samsung Clock app not found');
}

async function launchAlternativeClockApps(durationSeconds, label) {
  const alternatives = [
    'com.google.android.apps.alarms',
    'com.android.deskclock',
    'com.sec.android.app.clockwidget',
  ];

  for (const packageName of alternatives) {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.SET_TIMER', {
        extra: {
          'android.intent.extra.alarm.LENGTH': durationSeconds,
          'android.intent.extra.alarm.MESSAGE': label,
        },
        packageName,
        flags: 268435456,
      });
      console.log(`Timer launched via alternative package ${packageName}`);
      return;
    } catch (e) {
      console.warn(`Alternative package ${packageName} failed`, e);
    }
  }

  throw new Error('No compatible clock app found');
}

async function launchTimerViaLinking(durationSeconds, label) {
  const encodedLabel = encodeURIComponent(label);
  const intentUrl = `intent:#Intent;action=android.intent.action.SET_TIMER;S.android.intent.extra.alarm.MESSAGE=${encodedLabel};i.android.intent.extra.alarm.LENGTH=${durationSeconds};end`;
  return Linking.openURL(intentUrl);
}

function showTimerUnavailableAlert() {
  Alert.alert(
    'Timer app not available',
    'Could not launch the Clock app on your device. Please manually set a timer in your Clock app to track your meal duration.',
    [
      {
        text: 'OK',
        style: 'default',
      },
    ]
  );
}
