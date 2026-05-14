import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { insertGlucoseReading, listGlucoseReadings } from '../db/glucoseReadings';

export const MEAL_CONTEXT_OPTIONS = [
  { value: 'fasting', label: 'Fasting' },
  { value: 'before_meal', label: 'Before meal' },
  { value: 'after_meal', label: 'After meal' },
  { value: 'bedtime', label: 'Bedtime' },
  { value: 'other', label: 'Other' },
];

function labelForContext(value) {
  return MEAL_CONTEXT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatWhen(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BloodSugarLogScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [glucoseText, setGlucoseText] = useState('');
  const [mealContext, setMealContext] = useState(MEAL_CONTEXT_OPTIONS[0].value);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listGlucoseReadings(150);
      setHistory(rows);
    } catch (e) {
      console.error(e);
      Alert.alert('Could not load log', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const onSave = useCallback(async () => {
    const raw = glucoseText.trim();
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Invalid value', 'Enter a glucose number in mg/dL.');
      return;
    }
    if (n < 20 || n > 600) {
      Alert.alert('Out of range', 'Enter a value between 20 and 600 mg/dL.');
      return;
    }

    setSaving(true);
    try {
      await insertGlucoseReading({ valueMgdl: n, mealContext });
      setGlucoseText('');
      await loadHistory();
    } catch (e) {
      console.error(e);
      Alert.alert('Save failed', String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }, [glucoseText, mealContext, loadHistory]);

  const listHeader = (
    <>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Glucose (mg/dL)</Text>
        <TextInput
          style={styles.input}
          value={glucoseText}
          onChangeText={setGlucoseText}
          placeholder="e.g. 118"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          maxLength={6}
          returnKeyType="done"
        />

        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Meal context</Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.dropdown, pressed && styles.dropdownPressed]}
        >
          <Text style={styles.dropdownText}>{labelForContext(mealContext)}</Text>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={onSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            (pressed || saving) && styles.saveBtnPressed,
            saving && styles.saveBtnDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#041210" />
          ) : (
            <View style={styles.saveBtnInner}>
              <Ionicons name="checkmark-circle" size={22} color="#041210" />
              <Text style={styles.saveLabel}>Save reading</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>History</Text>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
    </>
  );

  const listEmpty = !loading ? (
    <View style={styles.emptyCard}>
      <Ionicons name="water-outline" size={36} color={colors.textTertiary} />
      <Text style={[styles.emptyText, styles.emptyTextSpaced]}>
        No readings yet. Add one above.
      </Text>
    </View>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Blood sugar log</Text>
          <Text style={styles.subtitle}>mg/dL · stored on this device</Text>
        </View>

        <FlatList
          data={history}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: tabBarHeight + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.historyRow}>
              <View style={styles.historyMain}>
                <Text style={styles.historyValue}>
                  {Math.round(item.value_mgdl)}
                  <Text style={styles.historyUnit}> mg/dL</Text>
                </Text>
                <Text style={styles.historyMeta}>{labelForContext(item.meal_context)}</Text>
              </View>
              <Text style={styles.historyTime}>{formatWhen(item.recorded_at)}</Text>
            </View>
          )}
        />

        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Meal context</Text>
              {MEAL_CONTEXT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setMealContext(opt.value);
                    setPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalOption,
                    mealContext === opt.value && styles.modalOptionSelected,
                    pressed && styles.modalOptionPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      mealContext === opt.value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {mealContext === opt.value ? (
                    <Ionicons name="checkmark" size={20} color={colors.accent} />
                  ) : null}
                </Pressable>
              ))}
              <Pressable style={styles.modalClose} onPress={() => setPickerOpen(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scroll: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 22,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldLabelSpaced: {
    marginTop: 18,
  },
  input: {
    marginTop: 10,
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  dropdown: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownPressed: {
    backgroundColor: colors.surfaceHover,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  saveBtn: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: 14,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtnPressed: {
    opacity: 0.92,
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveLabel: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#041210',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  loadingRow: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyTextSpaced: {
    marginTop: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyMain: {
    flex: 1,
    marginRight: 12,
  },
  historyValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  historyUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  historyMeta: {
    marginTop: 4,
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  historyTime: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modalOptionSelected: {
    backgroundColor: colors.accentSoft,
  },
  modalOptionPressed: {
    opacity: 0.85,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  modalOptionTextSelected: {
    color: colors.accent,
  },
  modalClose: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
