import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useMealAlarmSession } from '../hooks/useMealAlarmSession';
import { listMedicationsWithSchedules } from '../db/medications';
import {
  computeMedicationMetrics,
  formatDaysRemaining,
  LOW_STOCK_DAYS,
  summarizeInventory,
  SUPPLY_BAR_TARGET_DAYS,
} from '../domain/medicationCalculations';
import { getLatestGlucoseReading, getTodayGlucoseAggregate } from '../db/glucoseReadings';
import GlucoseImportModal from '../components/GlucoseImportModal';

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

export default function DashboardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [medSummary, setMedSummary] = useState(() => summarizeInventory([]));
  const {
    session,
    medicineLabel,
    glucoseLabel,
    startMeal,
    clearTimers,
    reload,
    nativeAlarmsAvailable,
    openExactAlarmSettings,
    exactAlarmBlocked,
  } = useMealAlarmSession();

  const [importOpen, setImportOpen] = useState(false);
  const [gLoading, setGLoading] = useState(true);
  const [gError, setGError] = useState(null);
  const [todayAgg, setTodayAgg] = useState(null);
  const [latestReading, setLatestReading] = useState(null);

  const loadMeds = useCallback(async () => {
    try {
      const list = await listMedicationsWithSchedules();
      const rows = list.map((med) => ({
        med,
        metrics: computeMedicationMetrics(med, med.scheduleEntries),
      }));
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

  const onIAte = useCallback(async () => {
    await startMeal();
    Alert.alert(
      'Meal start saved',
      nativeAlarmsAvailable
        ? 'Native Android alarms are scheduled for medication (30 min) and glucose check (2 hr). Countdowns below update live.'
        : 'Countdowns are saved on this device. Use an Android development build for native alarms when the app is closed.'
    );
  }, [startMeal, nativeAlarmsAvailable]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: tabBarHeight + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Dashboard</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setImportOpen(true)} style={styles.headerIconBtn}>
              <Ionicons name="download-outline" size={22} color={colors.accent} />
            </Pressable>
            <View style={styles.avatar}>
              <Ionicons name="pulse" size={22} color={colors.accent} />
            </View>
          </View>
        </View>

        {gLoading ? (
          <View style={[styles.card, styles.cardLoading]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingGlucose}>Loading glucose data…</Text>
          </View>
        ) : gError ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Glucose data</Text>
            <Text style={styles.gErr}>{gError}</Text>
            <Pressable onPress={loadGlucose} style={styles.retryGlucose}>
              <Text style={styles.retryGlucoseText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>Today's glucose</Text>
                {(() => {
                  const cnt = Number(todayAgg?.cnt ?? 0);
                  const avg = todayAgg?.avg_v != null ? Number(todayAgg.avg_v) : null;
                  const inRange =
                    avg != null && Number.isFinite(avg) && avg >= 70 && avg <= 180;
                  if (!cnt) {
                    return (
                      <View style={styles.badgeMuted}>
                        <Text style={styles.badgeMutedText}>No data today</Text>
                      </View>
                    );
                  }
                  return (
                    <View style={[styles.badge, inRange ? styles.badgeOk : styles.badgeWarn]}>
                      <View style={[styles.badgeDot, inRange ? styles.badgeDotOk : styles.badgeDotWarn]} />
                      <Text style={[styles.badgeText, inRange ? styles.badgeTextOk : styles.badgeTextWarn]}>
                        {inRange ? 'In range' : 'Out of range'}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              {Number(todayAgg?.cnt ?? 0) === 0 ? (
                <Text style={styles.emptyGlucose}>No readings logged for today yet.</Text>
              ) : (
                <>
                  <View style={styles.avgRow}>
                    <Text style={styles.avgValue}>
                      {Number(todayAgg.avg_v).toFixed(0)}
                    </Text>
                    <Text style={styles.avgUnit}>mg/dL avg</Text>
                  </View>
                  <Text style={styles.cardFoot}>
                    {Number(todayAgg.cnt)} reading{Number(todayAgg.cnt) === 1 ? '' : 's'} · min{' '}
                    {todayAgg.min_v != null ? Number(todayAgg.min_v).toFixed(0) : '—'} · max{' '}
                    {todayAgg.max_v != null ? Number(todayAgg.max_v).toFixed(0) : '—'} mg/dL
                  </Text>
                </>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Latest reading</Text>
              {!latestReading ? (
                <Text style={styles.emptyGlucose}>No readings in your log yet. Use Log or import CSV.</Text>
              ) : (
                <>
                  <View style={styles.latestRow}>
                    <Text style={styles.latestValue}>
                      {Number(latestReading.value_mgdl).toFixed(0)}
                    </Text>
                    <Text style={styles.latestUnit}>mg/dL</Text>
                  </View>
                  <View style={styles.latestMeta}>
                    <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.latestTime}>
                      {formatRelativeTime(latestReading.recorded_at)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </>
        )}

        <Pressable onPress={() => setImportOpen(true)} style={styles.importRow}>
          <Ionicons name="document-text-outline" size={18} color={colors.accent} />
          <Text style={styles.importRowText}>Import mySugr CSV</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>

        <Text style={styles.sectionLabel}>Medication stock</Text>
        {medSummary.medicationCount === 0 ? (
          <Pressable
            onPress={() => navigation.navigate('Meds')}
            style={({ pressed }) => [styles.invCard, pressed && styles.invCardPressed]}
          >
            <View style={styles.invRow}>
              <Ionicons name="medkit-outline" size={22} color={colors.accent} />
              <View style={styles.invTextCol}>
                <Text style={styles.invTitle}>Track your medications</Text>
                <Text style={styles.invSub}>
                  Add inventory, dosage, and daily schedules — estimates update automatically.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => navigation.navigate('Meds')}
              style={({ pressed }) => [styles.invCard, pressed && styles.invCardPressed]}
            >
              <View style={styles.invCardHeader}>
                <Text style={styles.invCardTitle}>Inventory overview</Text>
                <Text style={styles.invChev}>Meds</Text>
              </View>
              <Text style={styles.invStats}>
                {medSummary.medicationCount} medication
                {medSummary.medicationCount !== 1 ? 's' : ''} ·{' '}
                {Math.round(medSummary.totalTabletsOnHand)} tablets on hand
              </Text>
              <Text style={styles.invStats}>
                ~{medSummary.totalDailyTablets.toFixed(1)} tablets / day combined
              </Text>
              {medSummary.lowStockCount > 0 ? (
                <View style={styles.invWarn}>
                  <Ionicons name="warning-outline" size={16} color={colors.high} />
                  <Text style={styles.invWarnText}>
                    {medSummary.lowStockCount} below {LOW_STOCK_DAYS}-day supply at current pace
                  </Text>
                </View>
              ) : (
                <Text style={styles.invOk}>All medications above {LOW_STOCK_DAYS}-day supply.</Text>
              )}
            </Pressable>

            {medSummary.tightest ? (
              <Pressable
                onPress={() => navigation.navigate('Meds')}
                style={({ pressed }) => [styles.invCard, styles.invCardSecond, pressed && styles.invCardPressed]}
              >
                <Text style={styles.invCardTitle}>Shortest runway</Text>
                <Text style={styles.invTightName}>{medSummary.tightest.med.name}</Text>
                <Text style={styles.invTightMeta}>
                  ~{formatDaysRemaining(medSummary.tightest.metrics.daysRemaining)} remaining ·{' '}
                  {medSummary.tightest.metrics.tabletsPerDay.toFixed(1)} tabs/day
                </Text>
                <Text style={styles.invBarLabel}>
                  Supply vs {SUPPLY_BAR_TARGET_DAYS} days ({Math.round(medSummary.tightest.metrics.remainingPercent)}%)
                </Text>
                <StockBar
                  percent={medSummary.tightest.metrics.supplyBarPercent}
                  color={medSummary.tightest.metrics.isLowStock ? colors.high : colors.accent}
                />
              </Pressable>
            ) : (
              <View style={[styles.invCard, styles.invCardSecond]}>
                <Text style={styles.invCardTitle}>Schedules needed</Text>
                <Text style={styles.invSub}>
                  Add breakfast / lunch / dinner or custom times in Meds to estimate days left per drug.
                </Text>
              </View>
            )}
          </>
        )}

        {session ? (
          <View style={styles.timerCard}>
            <View style={styles.timerHeader}>
              <Text style={styles.timerTitle}>Meal timers</Text>
              <Pressable onPress={clearTimers} hitSlop={10}>
                <Text style={styles.timerClear}>Clear</Text>
              </Pressable>
            </View>
            <View style={styles.timerRow}>
              <Ionicons name="medical" size={20} color={colors.accent} />
              <View style={styles.timerTextCol}>
                <Text style={styles.timerLabel}>Medicine reminder</Text>
                <Text style={styles.timerValue}>{medicineLabel}</Text>
              </View>
            </View>
            <View style={[styles.timerRow, styles.timerRowSecond]}>
              <Ionicons name="water" size={20} color={colors.low} />
              <View style={styles.timerTextCol}>
                <Text style={styles.timerLabel}>Glucose test reminder</Text>
                <Text style={styles.timerValue}>{glucoseLabel}</Text>
              </View>
            </View>
            {Platform.OS === 'android' && !nativeAlarmsAvailable ? (
              <Text style={styles.timerFoot}>
                Native alarms require a development build (Expo Go does not ship this module).
              </Text>
            ) : null}
            {Platform.OS === 'android' && nativeAlarmsAvailable ? (
              <Pressable onPress={openExactAlarmSettings} style={styles.exactLink}>
                <Text style={styles.exactLinkText}>Exact alarm permission…</Text>
              </Pressable>
            ) : null}
            {exactAlarmBlocked ? (
              <View style={styles.exactWarn}>
                <Ionicons name="alert-circle" size={18} color={colors.high} />
                <Text style={styles.exactWarnText}>
                  Exact alarms are blocked by Android. Meal reminders may be delayed until you allow them in system
                  settings.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={onIAte}
          style={({ pressed }) => [
            styles.ateButton,
            pressed && styles.ateButtonPressed,
          ]}
        >
          <Ionicons name="restaurant" size={22} color="#0c0a06" />
          <Text style={styles.ateLabel}>I Ate</Text>
        </Pressable>

        <Text style={styles.hint}>
          Tap when you begin eating. On Android (dev build), AlarmManager schedules medication and
          glucose test alarms; timers persist across restarts.
        </Text>
      </ScrollView>

      <GlucoseImportModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadGlucose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  date: {
    marginTop: 4,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLoading: { alignItems: 'center', paddingVertical: 24 },
  loadingGlucose: { marginTop: 10, fontSize: 14, color: colors.textSecondary },
  gErr: { marginTop: 8, fontSize: 14, color: colors.high },
  retryGlucose: { marginTop: 12, alignSelf: 'flex-start' },
  retryGlucoseText: { fontSize: 15, fontWeight: '700', color: colors.accent },
  emptyGlucose: { marginTop: 8, fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  importRowText: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600', color: colors.text },
  badgeMuted: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceHover,
  },
  badgeMutedText: { fontSize: 12, fontWeight: '600', color: colors.textTertiary },
  badgeOk: { backgroundColor: 'rgba(110, 231, 183, 0.12)' },
  badgeWarn: { backgroundColor: 'rgba(251, 146, 60, 0.15)' },
  badgeDotOk: { backgroundColor: colors.inRange },
  badgeDotWarn: { backgroundColor: colors.high },
  badgeTextOk: { color: colors.inRange },
  badgeTextWarn: { color: colors.high },
  exactWarn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.35)',
  },
  exactWarnText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: colors.high,
    fontWeight: '600',
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inRange,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inRange,
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  avgValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -1,
  },
  avgUnit: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardFoot: {
    marginTop: 14,
    fontSize: 14,
    color: colors.textTertiary,
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  latestValue: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: -0.5,
  },
  latestUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  latestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  latestTime: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
  invCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  invCardSecond: {
    marginBottom: 14,
  },
  invCardPressed: {
    opacity: 0.92,
  },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invTextCol: { flex: 1, marginLeft: 12, marginRight: 8 },
  invTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  invSub: { marginTop: 6, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  invCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invCardTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  invChev: { fontSize: 13, fontWeight: '700', color: colors.accent },
  invStats: { marginTop: 4, fontSize: 14, color: colors.text, fontWeight: '600' },
  invWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    padding: 10,
    borderRadius: 12,
  },
  invWarnText: { flex: 1, marginLeft: 8, fontSize: 13, fontWeight: '600', color: colors.high, lineHeight: 18 },
  invOk: { marginTop: 10, fontSize: 13, color: colors.inRange, fontWeight: '600' },
  invTightName: { marginTop: 6, fontSize: 18, fontWeight: '700', color: colors.text },
  invTightMeta: { marginTop: 4, fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  invBarLabel: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stockBarTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: colors.background,
    marginTop: 6,
    overflow: 'hidden',
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  ateButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.ateCta,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.ateCta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  ateButtonPressed: {
    backgroundColor: colors.ateCtaPressed,
    transform: [{ scale: 0.99 }],
  },
  ateLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0c0a06',
    letterSpacing: 0.2,
  },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textTertiary,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  timerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  timerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  timerClear: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerRowSecond: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timerTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  timerFoot: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 16,
  },
  exactLink: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  exactLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
});
