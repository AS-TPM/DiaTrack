import * as IntentLauncher from 'expo-intent-launcher';
import { useCallback, useState } from 'react';
import { addMealLog } from '../db/mealLogs';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors as defaultColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { useMealAlarmSession } from '../hooks/useMealAlarmSession';
import { listMedicationsWithSchedules, logMealMedicationIntake } from '../db/medications';
import {
  computeMedicationMetrics,
  formatDaysRemaining,
  LOW_STOCK_DAYS,
  summarizeInventory,
  SUPPLY_BAR_TARGET_DAYS,
} from '../domain/medicationCalculations';
import { getLatestGlucoseReading, getTodayGlucoseAggregate } from '../db/glucoseReadings';
import GlucoseImportModal from '../components/GlucoseImportModal';

const MEAL_OPTIONS = [
  { type: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { type: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
  { type: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { type: 'snack', label: 'Snack', icon: 'cafe-outline' },
  { type: 'custom', label: 'Custom', icon: 'options-outline' },
];

function formatRelativeTime(recordedAt) {
  if (!recordedAt || !Number.isFinite(recordedAt)) return '';
  const diffMs = Date.now() - recordedAt;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function StockBar({ percent, color }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.stockBarTrack}>
      <View style={[styles.stockBarFill, { width: `${p}%`, backgroundColor: color }]} />
    </View>
  );
}

function MealStartModal({ visible, selectedType, customLabel, busy, onSelect, onCustomLabel, onClose, onConfirm }) {
  const selected = MEAL_OPTIONS.find((m) => m.type === selectedType) ?? MEAL_OPTIONS[0];
  const confirmLabel = selected.type === 'custom' && customLabel.trim() ? customLabel.trim() : selected.label;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.mealModalRoot}>
        <Pressable style={styles.mealModalBackdrop} onPress={busy ? undefined : onClose} />
        <View style={styles.mealSheet}>
          <View style={styles.mealSheetHandle} />
          <View style={styles.mealSheetHeader}>
            <View>
              <Text style={styles.mealSheetTitle}>Start meal timers</Text>
              <Text style={styles.mealSheetSub}>Choose the meal so matching medication reminders stay aligned.</Text>
            </View>
            <Pressable onPress={onClose} disabled={busy} hitSlop={10}>
              <Ionicons name="close" size={24} color={defaultColors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.mealOptionGrid}>
            {MEAL_OPTIONS.map((option) => {
              const active = option.type === selectedType;
              return (
                <Pressable
                  key={option.type}
                  onPress={() => onSelect(option.type)}
                  disabled={busy}
                  style={[styles.mealOption, active && styles.mealOptionActive]}
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={active ? defaultColors.accent : defaultColors.textSecondary}
                  />
                  <Text style={[styles.mealOptionText, active && styles.mealOptionTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedType === 'custom' ? (
            <View style={styles.customMealBox}>
              <Text style={styles.customMealLabel}>Custom label</Text>
              <TextInput
                value={customLabel}
                onChangeText={onCustomLabel}
                placeholder="e.g. Bedtime"
                placeholderTextColor={defaultColors.textTertiary}
                style={styles.customMealInput}
                editable={!busy}
              />
            </View>
          ) : null}

          <Pressable
            onPress={onConfirm}
            disabled={busy}
            style={({ pressed }) => [
              styles.mealConfirmBtn,
              pressed && styles.mealConfirmBtnPressed,
              busy && styles.mealConfirmBtnDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#041210" />
            ) : (
              <>
                <Ionicons name="restaurant" size={20} color="#041210" />
                <Text style={styles.mealConfirmText}>Start {confirmLabel}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 80;
  const { session, medicineLabel, glucoseLabel, startMeal, clearTimers, reload, nativeAlarmsAvailable, openExactAlarmSettings, exactAlarmBlocked } = useMealAlarmSession();
  const { colors } = useTheme();

  const [importOpen, setImportOpen] = useState(false);
  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [customMealLabel, setCustomMealLabel] = useState('');
  const [startingMeal, setStartingMeal] = useState(false);
  const [gLoading, setGLoading] = useState(true);
  const [gError, setGError] = useState(null);
  const [todayAgg, setTodayAgg] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [medSummary, setMedSummary] = useState(() => ({ medicationCount: 0, lowStockCount: 0, totalTabletsOnHand: 0, totalDailyTablets: 0, tightest: null }));

  const loadMeds = useCallback(async () => {
    try {
      const list = await listMedicationsWithSchedules();
      const rows = list.map((med) => ({ med, metrics: computeMedicationMetrics(med, med.scheduleEntries) }));
      setMedSummary(summarizeInventory(rows));
    } catch (e) {
      console.warn('medications load', e);
    }
  }, []);

  const loadGlucose = useCallback(async () => {
    setGLoading(true);
    setGError(null);
    try {
      const [t, l] = await Promise.all([getTodayGlucoseAggregate(), getLatestGlucoseReading()]);
      setTodayAgg(t);
      setLatestReading(l);
    } catch (e) {
      console.error(e);
      setGError(String(e?.message ?? e));
      setTodayAgg(null);
      setLatestReading(null);
    } finally {
      setGLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      loadMeds();
      loadGlucose();
    }, [reload, loadMeds, loadGlucose])
  );

  const onIAte = useCallback(() => {
    setMealPickerOpen(true);
  }, []);

  const confirmMealStart = useCallback(async () => {
    if (startingMeal) return;
    const selected = MEAL_OPTIONS.find((m) => m.type === selectedMealType) ?? MEAL_OPTIONS[0];
    const mealLabel = selected.type === 'custom' && customMealLabel.trim() ? customMealLabel.trim() : selected.label;

    setStartingMeal(true);
    try {
      const mealStartedAt = Date.now();
      const intake = await logMealMedicationIntake({ mealType: selected.type, mealLabel, mealStartedAt });
      await startMeal({ mealType: selected.type, mealLabel, intakeEventId: intake.eventId });
      await addMealLog({
  meal_type: selected.type,
  meal_label: mealLabel,
  started_at: mealStartedAt,
  glucose_check_time: mealStartedAt + (2 * 60 * 60 * 1000),
  medication_count: intake.deductedCount,
});
      await loadMeds();
      setMealPickerOpen(false);

      if (Platform.OS === 'android') {
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.SET_TIMER', {
            extra: {
              'android.intent.extra.alarm.LENGTH': 1800,
              'android.intent.extra.alarm.MESSAGE': 'Meal Timer',
              'android.intent.extra.alarm.SKIP_UI': false,
            },
          });
        } catch (e) {
          console.log('Failed to open native timer', e);
        }
      }

      const deductionText = intake.deductedCount > 0
        ? `${intake.deductedCount} medication${intake.deductedCount === 1 ? '' : 's'} deducted (${intake.totalTablets.toFixed(1)} tablets).`
        : 'No medications were scheduled for this meal.';

      Alert.alert(`${mealLabel} started`, `${deductionText} Medication and 2-hour glucose reminders were scheduled with Android alarms.`);
    } catch (e) {
      console.error(e);
      Alert.alert('Meal start failed', String(e?.message ?? e));
    } finally {
      setStartingMeal(false);
    }
  }, [customMealLabel, loadMeds, selectedMealType, startMeal, startingMeal]);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const estimatedHbA1c = todayAgg?.avg_v != null ? ((Number(todayAgg.avg_v) + 46.7) / 28.7).toFixed(1) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>Dashboard</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{today}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setImportOpen(true)} style={[styles.headerIconBtn, { borderColor: colors.border }]}>
              <Ionicons name="download-outline" size={22} color={colors.accent} />
            </Pressable>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
              <Ionicons name="pulse" size={22} color={colors.accent} />
            </View>
          </View>
        </View>

        <View style={[styles.topCards, { borderColor: colors.border }]}> 
          <View style={[styles.topCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Today's average</Text>
            <Text style={[styles.cardMetric, { color: colors.text }]}>{todayAgg?.avg_v != null ? Number(todayAgg.avg_v).toFixed(0) : '—'}</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              {todayAgg?.cnt ? `${todayAgg.cnt} readings · ${todayAgg.min_v?.toFixed(0) ?? '—'}/${todayAgg.max_v?.toFixed(0) ?? '—'}` : 'No readings today'}
            </Text>
          </View>
          <View style={[styles.topCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Latest reading</Text>
            <Text style={[styles.cardMetric, { color: colors.text }]}>{latestReading ? Number(latestReading.value_mgdl).toFixed(0) : '—'}</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{latestReading ? formatRelativeTime(latestReading.recorded_at) : 'No log yet'}</Text>
          </View>
          <View style={[styles.topCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Meal status</Text>
            <Text style={[styles.cardMetric, { color: colors.text }]}>{session ? 'Active' : 'Idle'}</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{session ? `${session.mealLabel}` : 'Start a meal to track reminders'}</Text>
          </View>
        </View>

        <View style={[styles.actionsGrid, { borderColor: colors.border }]}> 
          <Pressable
  style={[
    styles.actionCard,
    {
      backgroundColor: `${colors.accent}15`,
      borderColor: `${colors.accent}40`,
      shadowColor: colors.accent,
      borderWidth: 6,
    },
  ]}
  onPress={onIAte}
>
  <Ionicons
    name="restaurant"
    size={24}
    color={colors.accent}
  />

  <Text
    style={[
      styles.actionTitle,
      { color: colors.text },
    ]}
  >
    Start meal timer
  </Text>

  <Text
    style={[
      styles.actionCopy,
      { color: colors.textSecondary },
    ]}
  >
    Schedule medication and glucose reminders that stay in sync.
  </Text>
</Pressable>
          <Pressable style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate('Meds')}>
            <Ionicons name="medkit-outline" size={22} color={colors.accent} />
            <Text style={[styles.actionTitle, { color: colors.text }]}>Review meds</Text>
            <Text style={[styles.actionCopy, { color: colors.textSecondary }]}>See current stock, low supply alerts, and how many tablets remain.</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Medication stock</Text>
        {medSummary.medicationCount === 0 ? (
          <Pressable
            onPress={() => navigation.navigate('Meds')}
            style={[styles.invCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.invRow}>
              <Ionicons name="medkit-outline" size={22} color={colors.accent} />
              <View style={styles.invTextCol}>
                <Text style={[styles.invTitle, { color: colors.text }]}>Track your medications</Text>
                <Text style={[styles.invSub, { color: colors.textSecondary }]}>Add inventory, schedule doses, and keep stock estimates in one premium view.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </Pressable>
        ) : (
          <View style={[styles.invCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <View style={styles.invCardHeader}>
              <Text style={[styles.invCardTitle, { color: colors.text }]}>Inventory overview</Text>
              <Text style={[styles.invChev, { color: colors.textSecondary }]}>Meds</Text>
            </View>
            <Text style={[styles.invStats, { color: colors.text }]}>
              {medSummary.medicationCount} medication{medSummary.medicationCount !== 1 ? 's' : ''} · {Math.round(medSummary.totalTabletsOnHand)} tablets on hand
            </Text>
            <Text style={[styles.invStats, { color: colors.textSecondary }]}>~{medSummary.totalDailyTablets.toFixed(1)} tablets / day combined</Text>
            {medSummary.lowStockCount > 0 ? (
              <View style={styles.invWarn}>
                <Ionicons name="warning-outline" size={16} color={defaultColors.high} />
                <Text style={[styles.invWarnText, { color: defaultColors.high }]}> {medSummary.lowStockCount} below {LOW_STOCK_DAYS}-day supply</Text>
              </View>
            ) : (
              <Text style={[styles.invOk, { color: colors.textSecondary }]}>All medications above {LOW_STOCK_DAYS}-day supply.</Text>
            )}
          </View>
        )}

        {medSummary.tightest ? (
          <View style={[styles.invCard, styles.invCardSecond, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.invCardTitle, { color: colors.text }]}>Shortest runway</Text>
            <Text style={[styles.invTightName, { color: colors.text }]}>{medSummary.tightest.med.name}</Text>
            <Text style={[styles.invTightMeta, { color: colors.textSecondary }]}>
              ~{formatDaysRemaining(medSummary.tightest.metrics.daysRemaining)} remaining · {medSummary.tightest.metrics.tabletsPerDay.toFixed(1)} tabs/day
            </Text>
            <Text style={[styles.invBarLabel, { color: colors.textSecondary }]}>Supply vs {SUPPLY_BAR_TARGET_DAYS} days ({Math.round(medSummary.tightest.metrics.remainingPercent)}%)</Text>
            <StockBar percent={medSummary.tightest.metrics.supplyBarPercent} color={medSummary.tightest.metrics.isLowStock ? defaultColors.high : colors.accent} />
          </View>
        ) : null}

        {session ? (
          <View style={[styles.timerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <View style={styles.timerHeader}>
              <View>
                <Text style={[styles.timerTitle, { color: colors.text }]}>Meal timers</Text>
                {session.mealLabel ? <Text style={[styles.timerMealLabel, { color: colors.textSecondary }]}>{session.mealLabel}</Text> : null}
              </View>
              <Pressable onPress={clearTimers} hitSlop={10}>
                <Text style={[styles.timerClear, { color: colors.accent }]}>Clear</Text>
              </Pressable>
            </View>
            <View style={[styles.timerRow, { borderTopColor: colors.border }]}> 
              <Ionicons name="medical" size={20} color={colors.accent} />
              <View style={styles.timerTextCol}>
                <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>Medicine reminder</Text>
                <Text style={[styles.timerValue, { color: colors.text }]}>{medicineLabel}</Text>
              </View>
            </View>
            <View style={[styles.timerRow, styles.timerRowSecond, { borderTopColor: colors.border }]}> 
              <Ionicons name="water" size={20} color={colors.low} />
              <View style={styles.timerTextCol}>
                <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>Glucose test reminder</Text>
                <Text style={[styles.timerValue, { color: colors.text }]}>{glucoseLabel}</Text>
              </View>
            </View>
            {Platform.OS === 'android' && !nativeAlarmsAvailable ? (
              <Text style={[styles.timerFoot, { color: colors.textSecondary }]}>Native alarms require a development build.</Text>
            ) : null}
            {Platform.OS === 'android' && nativeAlarmsAvailable ? (
              <Pressable onPress={openExactAlarmSettings} style={styles.exactLink}>
                <Text style={[styles.exactLinkText, { color: colors.accent }]}>Exact alarm permission…</Text>
              </Pressable>
            ) : null}
            {exactAlarmBlocked ? (
              <View style={styles.exactWarn}>
                <Ionicons name="alert-circle" size={18} color={defaultColors.high} />
                <Text style={[styles.exactWarnText, { color: defaultColors.high }]}>Exact alarms are blocked by Android. Reminders may be delayed until you allow them in settings.</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <GlucoseImportModal visible={importOpen} onClose={() => setImportOpen(false)} />
      <MealStartModal
        visible={mealPickerOpen}
        selectedType={selectedMealType}
        customLabel={customMealLabel}
        busy={startingMeal}
        onSelect={setSelectedMealType}
        onCustomLabel={setCustomMealLabel}
        onClose={() => setMealPickerOpen(false)}
        onConfirm={confirmMealStart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  greeting: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  date: { marginTop: 4, fontSize: 14, fontWeight: '500' },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headerIconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scroll: { paddingHorizontal: 20 },
  topCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  topCard: {
    flex: 1,
    minWidth: '48%',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  cardMetric: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  cardSub: { marginTop: 10, fontSize: 13, lineHeight: 20 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actionCard: {
    flex: 1,
    minWidth: '48%',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
  },
  actionTitle: { marginTop: 10, fontSize: 16, fontWeight: '700' },
  actionCopy: { marginTop: 8, fontSize: 13, lineHeight: 18 },
  sectionLabel: { marginTop: 2, marginBottom: 10, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  invCard: {
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    marginBottom: 14,
  },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  invTextCol: { flex: 1 },
  invTitle: { fontSize: 16, fontWeight: '800' },
  invSub: { marginTop: 6, fontSize: 13, lineHeight: 20 },
  invChev: { fontSize: 13, fontWeight: '700' },
  invStats: { marginTop: 8, fontSize: 13, lineHeight: 20 },
  invWarn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  invWarnText: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  invOk: { marginTop: 12, fontSize: 13, lineHeight: 20 },
  invCardSecond: { marginBottom: 16 },
  invTightName: { marginTop: 8, fontSize: 18, fontWeight: '800' },
  invTightMeta: { marginTop: 6, fontSize: 13, lineHeight: 20 },
  invBarLabel: { marginTop: 12, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  stockBarTrack: { height: 10, borderRadius: 6, backgroundColor: '#0a0c10', overflow: 'hidden', marginTop: 8 },
  stockBarFill: { height: '100%', borderRadius: 6 },
  timerCard: {
    borderRadius: 18,
    padding: 26,
    borderWidth: 1,
    marginBottom: 30,
  },
  timerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerTitle: { fontSize: 16, fontWeight: '800' },
  timerMealLabel: { marginTop: 4, fontSize: 13 },
  timerClear: { fontSize: 14, fontWeight: '700' },
  timerRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 18 },
  timerRowSecond: { borderTopWidth: 1 },
  timerTextCol: { flex: 1 },
  timerLabel: { fontSize: 13, fontWeight: '700' },
  timerValue: { marginTop: 4, fontSize: 15, fontWeight: '700' },
  timerFoot: { marginTop: 12, fontSize: 12, lineHeight: 18 },
  exactLink: { marginTop: 14 },
  exactLinkText: { fontSize: 14, fontWeight: '700' },
  exactWarn: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  exactWarnText: { flex: 1, fontSize: 12, lineHeight: 18 },
  mealModalRoot: { flex: 1, justifyContent: 'flex-end' },
  mealModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  mealSheet: {
    backgroundColor: defaultColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 15,
    borderWidth: 1,
    borderColor: defaultColors.border,
  },
  mealSheetHandle: {
    width: 48,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  mealSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  mealSheetTitle: { fontSize: 18, fontWeight: '800', color: defaultColors.text },
  mealSheetSub: { marginTop: 4, fontSize: 13, lineHeight: 20, color: defaultColors.textSecondary, maxWidth: '78%' },
  mealOptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  mealOption: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: defaultColors.border,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: defaultColors.surface,
    alignItems: 'center',
    gap: 8,
  },
  mealOptionActive: {
    borderColor: defaultColors.accent,
    backgroundColor: 'rgba(94,230,208,0.1)',
  },
  mealOptionText: { marginTop: 4, fontSize: 13, color: defaultColors.text },
  mealOptionTextActive: { color: defaultColors.accent, fontWeight: '700' },
  customMealBox: { marginBottom: 14 },
  customMealLabel: { color: defaultColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  customMealInput: {
    backgroundColor: defaultColors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: defaultColors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: defaultColors.text,
    fontSize: 16,
  },
  mealConfirmBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    paddingVertical: 16,
    backgroundColor: defaultColors.accent,
  },
  mealConfirmBtnPressed: { opacity: 0.92 },
  mealConfirmBtnDisabled: { opacity: 0.7 },
  mealConfirmText: { color: '#041210', fontSize: 15, fontWeight: '800' },
});
