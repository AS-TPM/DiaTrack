import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { launchAndroidTimer } from '../services/timerLauncher';
import { insertCustomReminder, updateCustomReminder, REMINDER_TYPES, REMINDER_MEAL_TYPES } from '../db/reminders';

const REMINDER_OPTIONS = [
  { key: REMINDER_TYPES.MEDICATION, label: 'Medication reminder' },
  { key: REMINDER_TYPES.GLUCOSE, label: 'Post-meal glucose check' },
];

const MEAL_OPTIONS = [
  { key: REMINDER_MEAL_TYPES.BREAKFAST, label: 'Breakfast' },
  { key: REMINDER_MEAL_TYPES.LUNCH, label: 'Lunch' },
  { key: REMINDER_MEAL_TYPES.DINNER, label: 'Dinner' },
  { key: REMINDER_MEAL_TYPES.SNACK, label: 'Snack' },
  { key: REMINDER_MEAL_TYPES.CUSTOM, label: 'Custom' },
];

export default function ReminderCreatorModal({ visible, onClose, onSaved, reminder }) {
  const { colors } = useTheme();
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState('30');
  const [reminderType, setReminderType] = useState(REMINDER_TYPES.MEDICATION);
  const [mealType, setMealType] = useState(REMINDER_MEAL_TYPES.BREAKFAST);
  const [useClock, setUseClock] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

    if (reminder?.id) {
      setLabel(reminder.label ?? '');
      setDuration(String(reminder.duration_minutes ?? 30));
      setReminderType(reminder.reminder_type ?? REMINDER_TYPES.MEDICATION);
      setMealType(reminder.meal_type ?? REMINDER_MEAL_TYPES.BREAKFAST);
      setUseClock(Boolean(reminder.use_clock));
    } else {
      setLabel('');
      setDuration('30');
      setReminderType(REMINDER_TYPES.MEDICATION);
      setMealType(REMINDER_MEAL_TYPES.BREAKFAST);
      setUseClock(true);
    }

    setSaving(false);
  }, [visible, reminder]);

  const isEditing = Boolean(reminder?.id);
  const moodLabel = useMemo(() => {
    if (label.trim()) return label.trim();
    return reminderType === REMINDER_TYPES.GLUCOSE ? 'Post-meal glucose' : 'Medication reminder';
  }, [label, reminderType]);

  const handleSave = useCallback(async () => {
    const trimmedLabel = moodLabel;
    const minutes = Number.parseInt(String(duration).trim(), 10);
    if (!trimmedLabel) {
      Alert.alert('Reminder label required', 'Enter a name for the reminder.');
      return;
    }
    if (!(minutes > 0)) {
      Alert.alert('Reminder duration', 'Enter a duration in minutes greater than zero.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateCustomReminder(reminder.id, {
          label: trimmedLabel,
          reminder_type: reminderType,
          meal_type: mealType,
          duration_minutes: minutes,
          enabled: reminder.enabled ?? true,
          use_clock: useClock,
        });
      } else {
        await insertCustomReminder({
          label: trimmedLabel,
          reminder_type: reminderType,
          meal_type: mealType,
          duration_minutes: minutes,
          enabled: true,
          use_clock: useClock,
        });
      }

      if (useClock && Platform.OS === 'android') {
        await launchAndroidTimer(minutes * 60, trimmedLabel);
      }
      onSaved?.();
      onClose?.();
    } catch (error) {
      console.error(error);
      Alert.alert('Could not save reminder', String(error?.message ?? error));
    } finally {
      setSaving(false);
    }
  }, [isEditing, mealType, moodLabel, onClose, onSaved, reminder, reminderType, duration, useClock]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{isEditing ? 'Edit reminder' : 'Create reminder'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Reminder type</Text>
          <View style={styles.optionRow}>
            {REMINDER_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setReminderType(option.key)}
                style={[
                  styles.optionPill,
                  { borderColor: colors.border, backgroundColor: reminderType === option.key ? colors.accentSoft : colors.surface },
                ]}
              >
                <Text style={[styles.optionText, { color: reminderType === option.key ? colors.text : colors.textSecondary }]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Meal context</Text>
          <View style={styles.optionRow}>
            {MEAL_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setMealType(option.key)}
                style={[
                  styles.optionPill,
                  { borderColor: colors.border, backgroundColor: mealType === option.key ? colors.accentSoft : colors.surface },
                ]}
              >
                <Text style={[styles.optionText, { color: mealType === option.key ? colors.text : colors.textSecondary }]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Label</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={moodLabel}
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
          />

          <View style={styles.row}> 
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Duration</Text>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
              />
            </View>
            <View style={{ marginLeft: 12, justifyContent: 'flex-end' }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Clock</Text>
              <Pressable
                onPress={() => setUseClock((prev) => !prev)}
                style={[
                  styles.toggle,
                  { backgroundColor: useClock ? colors.accent : colors.surface },
                ]}
              >
                <Ionicons name={useClock ? 'checkmark' : 'close'} size={18} color={useClock ? '#071014' : colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>Save a custom timer for medication or post-meal glucose follow-up. Android timer will launch automatically when enabled.</Text>

          <Pressable onPress={handleSave} style={[styles.saveButton, { backgroundColor: colors.accent }] } disabled={saving}>
            {saving ? <ActivityIndicator color="#041210" /> : <Text style={styles.saveText}>{isEditing ? 'Save changes' : 'Save reminder'}</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = {
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  optionPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionText: { fontSize: 13, fontWeight: '700' },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  toggle: {
    width: 48,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 18 },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#041210', fontWeight: '800', fontSize: 15 },
};
