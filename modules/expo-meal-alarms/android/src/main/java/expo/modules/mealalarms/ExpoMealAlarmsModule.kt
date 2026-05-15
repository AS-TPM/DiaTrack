package expo.modules.mealalarms

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMealAlarmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoMealAlarms")

    Function("scheduleFromMealStart") { mealStartMs: Double ->
      val ctx = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("Application context is not available")
      val meal = mealStartMs.toLong()
      val allExact = MealAlarmScheduler.schedule(ctx, meal)
      val prefs = ctx.getSharedPreferences(MealAlarmScheduler.PREFS_NAME, Context.MODE_PRIVATE)
      val medAt = prefs.getLong(MealAlarmScheduler.KEY_MED_AT, meal + MealAlarmScheduler.MED_LAG_MS)
      val gluAt = prefs.getLong(MealAlarmScheduler.KEY_GLU_AT, meal + MealAlarmScheduler.GLU_LAG_MS)
      val canExact = MealAlarmScheduler.canScheduleExactAlarms(ctx)
      mapOf(
        "ok" to true,
        "medicineAtMs" to medAt.toDouble(),
        "glucoseAtMs" to gluAt.toDouble(),
        "canScheduleExactAlarms" to canExact,
        "allExactAlarms" to allExact,
        "alarmClockExactSupported" to true,
        "postNotificationsGranted" to hasPostNotificationsPermission(ctx),
        "batteryOptimizationIgnored" to isIgnoringBatteryOptimizations(ctx),
        "manufacturer" to Build.MANUFACTURER,
        "isSamsung" to Build.MANUFACTURER.equals("samsung", true)
      )
    }

    Function("scheduleAtTimes") { mealStartMs: Double, medicineAtMs: Double, glucoseAtMs: Double ->
      val ctx = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("Application context is not available")
      val meal = mealStartMs.toLong()
      val medAt = medicineAtMs.toLong()
      val gluAt = glucoseAtMs.toLong()
      val allExact = MealAlarmScheduler.scheduleAtTimes(ctx, meal, medAt, gluAt)
      val canExact = MealAlarmScheduler.canScheduleExactAlarms(ctx)
      mapOf(
        "ok" to true,
        "medicineAtMs" to medAt.toDouble(),
        "glucoseAtMs" to gluAt.toDouble(),
        "canScheduleExactAlarms" to canExact,
        "allExactAlarms" to allExact,
        "alarmClockExactSupported" to true,
        "postNotificationsGranted" to hasPostNotificationsPermission(ctx),
        "batteryOptimizationIgnored" to isIgnoringBatteryOptimizations(ctx),
        "manufacturer" to Build.MANUFACTURER,
        "isSamsung" to Build.MANUFACTURER.equals("samsung", true)
      )
    }

    Function("cancelAll") {
      appContext.reactContext?.applicationContext?.let { ctx ->
        MealAlarmScheduler.cancelAll(ctx)
      }
    }

    Function("canScheduleExactAlarms") {
      val ctx = appContext.reactContext?.applicationContext ?: return@Function false
      MealAlarmScheduler.canScheduleExactAlarms(ctx)
    }

    Function("openExactAlarmSettings") {
      appContext.reactContext?.applicationContext?.let { ctx ->
        MealAlarmScheduler.openExactAlarmSettings(ctx)
      }
    }

    Function("getExactAlarmStatus") {
      val ctx = appContext.reactContext?.applicationContext ?: return@Function mapOf(
        "canScheduleExactAlarms" to false,
        "sdkInt" to Build.VERSION.SDK_INT.toDouble(),
        "hasNativeModule" to false,
        "alarmClockExactSupported" to true,
        "postNotificationsGranted" to false,
        "batteryOptimizationIgnored" to false,
        "manufacturer" to Build.MANUFACTURER,
        "isSamsung" to Build.MANUFACTURER.equals("samsung", true)
      )
      val can = MealAlarmScheduler.canScheduleExactAlarms(ctx)
      mapOf(
        "canScheduleExactAlarms" to can,
        "sdkInt" to Build.VERSION.SDK_INT.toDouble(),
        "hasNativeModule" to true,
        "alarmClockExactSupported" to true,
        "postNotificationsGranted" to hasPostNotificationsPermission(ctx),
        "batteryOptimizationIgnored" to isIgnoringBatteryOptimizations(ctx),
        "manufacturer" to Build.MANUFACTURER,
        "isSamsung" to Build.MANUFACTURER.equals("samsung", true)
      )
    }

    Function("isIgnoringBatteryOptimizations") {
      val ctx = appContext.reactContext?.applicationContext ?: return@Function true
      isIgnoringBatteryOptimizations(ctx)
    }

    Function("openBatteryOptimizationSettings") {
      appContext.reactContext?.applicationContext?.let { ctx ->
        openBatteryOptimizationSettings(ctx)
      }
    }
  }

  private fun hasPostNotificationsPermission(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return true
    }
    return ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun isIgnoringBatteryOptimizations(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return true
    }
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(context.packageName)
  }

  private fun openBatteryOptimizationSettings(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return
    }
    val packageUri = Uri.parse("package:${context.packageName}")
    val intents = listOf(
      Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = packageUri
      },
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = packageUri
      },
      Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
    )
    for (intent in intents) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        return
      } catch (_: Exception) {
      }
    }
  }
}
