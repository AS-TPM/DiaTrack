package expo.modules.mealalarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log

object MealAlarmScheduler {
  private const val TAG = "MealAlarmScheduler"

  const val PREFS_NAME = "expo_meal_alarms_prefs"
  const val KEY_MEAL_START = "meal_start_ms"
  const val KEY_MED_AT = "medicine_at_ms"
  const val KEY_GLU_AT = "glucose_at_ms"

  const val MED_LAG_MS = 30L * 60L * 1000L
  const val GLU_LAG_MS = 2L * 60L * 60L * 1000L
  const val ACTION_EXACT_ALARM_PERMISSION_CHANGED =
    "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"

  private const val RC_MED = 94001
  private const val RC_GLU = 94002
  private const val RC_SHOW_BASE = 9910
  private const val ACTION_FIRE_ALARM = "expo.modules.mealalarms.FIRE_MEAL_ALARM"

  fun canScheduleExactAlarms(context: Context): Boolean {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      am.canScheduleExactAlarms()
    } else {
      true
    }
  }

  fun openExactAlarmSettings(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
        data = Uri.parse("package:${context.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        context.startActivity(intent)
      } catch (_: Exception) {
      }
    }
  }

  /** @return true if every scheduled alarm used exact clock APIs (setAlarmClock / setExact). */
  fun schedule(context: Context, mealStartMs: Long): Boolean {
    return scheduleAtTimes(context, mealStartMs, mealStartMs + MED_LAG_MS, mealStartMs + GLU_LAG_MS)
  }

  /** @return true if every scheduled alarm used exact clock APIs (setAlarmClock / setExact). */
  fun scheduleAtTimes(context: Context, mealStartMs: Long, medicineAtMs: Long, glucoseAtMs: Long): Boolean {
    cancelAll(context)
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
      .putLong(KEY_MEAL_START, mealStartMs)
      .putLong(KEY_MED_AT, medicineAtMs)
      .putLong(KEY_GLU_AT, glucoseAtMs)
      .apply()
    return scheduleAlarmsIfFuture(context, medicineAtMs, glucoseAtMs)
  }

  fun reschedulePersistedAlarms(context: Context) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val mealStart = prefs.getLong(KEY_MEAL_START, 0L)
    if (mealStart == 0L) {
      return
    }
    val medAt = prefs.getLong(KEY_MED_AT, mealStart + MED_LAG_MS)
    val gluAt = prefs.getLong(KEY_GLU_AT, mealStart + GLU_LAG_MS)
    val now = System.currentTimeMillis()
    if (now >= medAt && now >= gluAt) {
      cancelAll(context)
      return
    }
    cancelAlarmIntentsOnly(context)
    scheduleAlarmsIfFuture(context, medAt, gluAt)
  }

  /** @return true if all scheduled alarms used exact APIs. */
  private fun scheduleAlarmsIfFuture(context: Context, medAt: Long, gluAt: Long): Boolean {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val now = System.currentTimeMillis()
    var allExact = true
    if (medAt > now) {
      if (!scheduleOne(
          context,
          am,
          RC_MED,
          medAt,
          "medicine",
          "DiaTrack medication reminder",
          "30 minutes after your meal — take your medication."
        )
      ) {
        allExact = false
      }
    }
    if (gluAt > now) {
      if (!scheduleOne(
          context,
          am,
          RC_GLU,
          gluAt,
          "glucose",
          "DiaTrack glucose check",
          "2 hours after your meal — check your blood sugar."
        )
      ) {
        allExact = false
      }
    }
    if (medAt <= now && gluAt <= now) {
      cancelAll(context)
    }
    return allExact
  }

  /** @return true if exact alarm path succeeded. */
  private fun scheduleOne(
    context: Context,
    am: AlarmManager,
    requestCode: Int,
    atMs: Long,
    kind: String,
    title: String,
    body: String
  ): Boolean {
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val intent = Intent(context, MealAlarmReceiver::class.java).apply {
      action = ACTION_FIRE_ALARM
      putExtra(MealAlarmReceiver.EXTRA_KIND, kind)
      putExtra(MealAlarmReceiver.EXTRA_TITLE, title)
      putExtra(MealAlarmReceiver.EXTRA_BODY, body)
      setPackage(context.packageName)
    }
    val operation = PendingIntent.getBroadcast(context, requestCode, intent, flags)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    } ?: Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_LAUNCHER)
      setPackage(context.packageName)
    }
    val showPi = PendingIntent.getActivity(
      context,
      RC_SHOW_BASE + requestCode,
      launchIntent,
      flags
    )

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        val info = AlarmManager.AlarmClockInfo(atMs, showPi)
        am.setAlarmClock(info, operation)
      } else {
        @Suppress("DEPRECATION")
        am.setExact(AlarmManager.RTC_WAKEUP, atMs, operation)
      }
      return true
    } catch (e: SecurityException) {
      Log.w(TAG, "Exact alarm denied (setAlarmClock); using inexact fallback", e)
      return scheduleInexactFallback(am, atMs, operation)
    }
  }

  private fun scheduleInexactFallback(am: AlarmManager, atMs: Long, operation: PendingIntent): Boolean {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, operation)
      } else {
        @Suppress("DEPRECATION")
        am.setExact(AlarmManager.RTC_WAKEUP, atMs, operation)
      }
      return false
    } catch (e: Exception) {
      Log.e(TAG, "Alarm scheduling failed", e)
      throw e
    }
  }

  fun cancelAlarmIntentsOnly(context: Context) {
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    listOf(RC_MED, RC_GLU).forEach { rc ->
      val intent = Intent(context, MealAlarmReceiver::class.java).apply {
        action = ACTION_FIRE_ALARM
        setPackage(context.packageName)
      }
      val pi = PendingIntent.getBroadcast(context, rc, intent, flags)
      am.cancel(pi)
      pi.cancel()
    }
  }

  fun cancelAll(context: Context) {
    cancelAlarmIntentsOnly(context)
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
  }
}
