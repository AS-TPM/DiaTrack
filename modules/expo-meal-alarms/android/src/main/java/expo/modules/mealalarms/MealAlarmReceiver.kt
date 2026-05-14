package expo.modules.mealalarms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class MealAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent == null) {
      return
    }
    val appCtx = context.applicationContext
    val kind = intent.getStringExtra(EXTRA_KIND) ?: return
    val title = intent.getStringExtra(EXTRA_TITLE) ?: "Reminder"
    val body = intent.getStringExtra(EXTRA_BODY) ?: ""

    val pm = appCtx.getSystemService(Context.POWER_SERVICE) as PowerManager
    val wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DiaTrack:MealAlarmWake")
    wakeLock.acquire(2 * 60 * 1000L)
    try {
      ensureChannel(appCtx)
      val nm = appCtx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      val launch = appCtx.packageManager.getLaunchIntentForPackage(appCtx.packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
      val contentPi = if (launch != null) {
        val f = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        PendingIntent.getActivity(appCtx, 87000 + kind.hashCode(), launch, f)
      } else {
        null
      }

      val alarmUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

      val notification = NotificationCompat.Builder(appCtx, CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setContentIntent(contentPi)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setSound(alarmUri)
        .setLights(Color.WHITE, 500, 500)
        .setVibrate(longArrayOf(0, 400, 200, 400, 200, 600))
        .build()

      val id = if (kind == "medicine") NOTIFICATION_ID_MED else NOTIFICATION_ID_GLU
      nm.notify(id, notification)
    } finally {
      if (wakeLock.isHeld) {
        wakeLock.release()
      }
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) != null) {
      return
    }

    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Meal & glucose alarms",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Native alarm reminders after meals"
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 400, 200, 400)
      setSound(soundUri, attrs)
      enableLights(true)
    }
    nm.createNotificationChannel(channel)
  }

  companion object {
    const val EXTRA_KIND = "kind"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val CHANNEL_ID = "expo_meal_alarms_clock"
    const val NOTIFICATION_ID_MED = 88001
    const val NOTIFICATION_ID_GLU = 88002
  }
}
