package expo.modules.mealalarms

import android.content.Context
import android.os.Build
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
        "allExactAlarms" to allExact
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
        "hasNativeModule" to false
      )
      val can = MealAlarmScheduler.canScheduleExactAlarms(ctx)
      mapOf(
        "canScheduleExactAlarms" to can,
        "sdkInt" to Build.VERSION.SDK_INT.toDouble(),
        "hasNativeModule" to true
      )
    }
  }
}
