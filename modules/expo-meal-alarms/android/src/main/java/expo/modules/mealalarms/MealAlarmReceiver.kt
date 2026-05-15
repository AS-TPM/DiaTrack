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
    val title = titleForKind(kind)
    val body = bodyForKind(kind)

    val pm = appCtx.getSystemService(Context.POWER_SERVICE) as PowerManager
    val wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DiaTrack:MealAlarmWake")
    wakeLock.acquire(2 * 60 * 1000L)
    try {
      ensureChannels(appCtx)
      val nm = appCtx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      val contentPi = buildContentIntent(appCtx, kind)

      val alarmUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      val channelId = channelIdForKind(kind)
      val openLabel = if (kind == KIND_GLUCOSE) "Log glucose" else "Open medications"

      val notification = NotificationCompat.Builder(appCtx, channelId)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setContentIntent(contentPi)
        .setAutoCancel(false)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setSound(alarmUri)
        .setLights(Color.WHITE, 500, 500)
        .setVibrate(VIBRATION_PATTERN)
        .addAction(android.R.drawable.ic_menu_view, openLabel, contentPi)
        .build()

      val id = if (kind == KIND_MEDICINE) NOTIFICATION_ID_MED else NOTIFICATION_ID_GLU
      nm.notify(id, notification)
    } finally {
      if (wakeLock.isHeld) {
        wakeLock.release()
      }
    }
  }

  private fun buildContentIntent(context: Context, kind: String): PendingIntent {
    val route = if (kind == KIND_GLUCOSE) "log" else "meds"
    val source = if (kind == KIND_GLUCOSE) "glucose_reminder" else "medicine_reminder"
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("diatrack://$route?source=$source")
      putExtra("targetScreen", if (kind == KIND_GLUCOSE) "Log" else "Meds")
      putExtra("notificationKind", kind)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    } ?: Intent(Intent.ACTION_VIEW, Uri.parse("diatrack://$route?source=$source")).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getActivity(context, 87000 + kind.hashCode(), launch, flags)
  }

  private fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    listOf(
      ChannelSpec(CHANNEL_ID_MEDICINE, "DiaTrack medication reminders", "Medication reminders after meals"),
      ChannelSpec(CHANNEL_ID_GLUCOSE, "DiaTrack glucose reminders", "Post-meal glucose check reminders")
    ).forEach { spec ->
      if (nm.getNotificationChannel(spec.id) == null) {
        val channel = NotificationChannel(
          spec.id,
          spec.name,
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = spec.description
          enableVibration(true)
          vibrationPattern = VIBRATION_PATTERN
          setSound(soundUri, attrs)
          enableLights(true)
          lightColor = Color.WHITE
          lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(channel)
      }
    }
  }

  private fun channelIdForKind(kind: String): String {
    return if (kind == KIND_MEDICINE) CHANNEL_ID_MEDICINE else CHANNEL_ID_GLUCOSE
  }

  private fun titleForKind(kind: String): String {
    return if (kind == KIND_MEDICINE) {
      "DiaTrack medication reminder"
    } else {
      "DiaTrack glucose check"
    }
  }

  private fun bodyForKind(kind: String): String {
    return if (kind == KIND_MEDICINE) {
      "Take the medication scheduled for this meal."
    } else {
      "Log your post-meal glucose reading now."
    }
  }

  companion object {
    const val EXTRA_KIND = "kind"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    private const val KIND_MEDICINE = "medicine"
    private const val KIND_GLUCOSE = "glucose"
    const val CHANNEL_ID_MEDICINE = "diatrack_medication_alarms_v2"
    const val CHANNEL_ID_GLUCOSE = "diatrack_glucose_alarms_v2"
    const val NOTIFICATION_ID_MED = 88001
    const val NOTIFICATION_ID_GLU = 88002
    private val VIBRATION_PATTERN = longArrayOf(0, 500, 180, 500, 180, 800)
  }

  private data class ChannelSpec(
    val id: String,
    val name: String,
    val description: String
  )
}
