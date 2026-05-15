import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors as defaultColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import {
  getGlucoseAggregateInRange,
  getLatestGlucoseReading,
} from '../db/glucoseReadings';
import { listMedicationsWithSchedules } from '../db/medications';
import {
  computeMedicationMetrics,
  formatDaysRemaining,
  summarizeInventory,
} from '../domain/medicationCalculations';
import { useMealAlarmSession } from '../hooks/useMealAlarmSession';

const PROFILE_STORAGE_KEY = '@diatrack/profile_v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PROFILE = {
  name: 'Your name',
  email: '',
  targetRange: '70 - 130 mg/dL',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { session, medicineLabel, glucoseLabel, clearTimers } = useMealAlarmSession();
  const { colors, accent, setAccent, themePresets } = useTheme();

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftTargetRange, setDraftTargetRange] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [latestReading, setLatestReading] = useState(null);
  const [avg7Day, setAvg7Day] = useState(null);
  const [medSummary, setMedSummary] = useState({ medicationCount: 0, lowStockCount: 0, tightest: null });

  const estimatedA1c = useMemo(() => {
    if (!avg7Day || !Number.isFinite(avg7Day)) return null;
    return ((avg7Day + 46.7) / 28.7).toFixed(1);
  }, [avg7Day]);

  const loadProfile = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      setProfile({ ...DEFAULT_PROFILE, ...stored });
    } catch (error) {
      console.warn('Failed to load profile', error);
    }
  }, []);

  const saveProfile = useCallback(async () => {
    const next = {
      name: draftName.trim() || DEFAULT_PROFILE.name,
      email: draftEmail.trim(),
      targetRange: draftTargetRange.trim() || DEFAULT_PROFILE.targetRange,
    };
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
      setProfile(next);
      setEditOpen(false);
    } catch (error) {
      console.warn('Failed to save profile', error);
    }
  }, [draftName, draftEmail, draftTargetRange]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      await loadProfile();
      const [latest, stats, medications] = await Promise.all([
        getLatestGlucoseReading(),
        getGlucoseAggregateInRange(Date.now() - SEVEN_DAYS_MS, Date.now()),
        listMedicationsWithSchedules(),
      ]);
      setLatestReading(latest ?? null);
      setAvg7Day(stats?.avg_v ? Number(stats.avg_v) : null);
      const medicationRows = medications.map((med) => ({
        med,
        metrics: computeMedicationMetrics(med, med.scheduleEntries || []),
      }));
      setMedSummary(summarizeInventory(medicationRows));
    } catch (error) {
      console.warn('Failed to load dashboard', error);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const openEditor = () => {
    setDraftName(profile.name || '');
    setDraftEmail(profile.email || '');
    setDraftTargetRange(profile.targetRange || DEFAULT_PROFILE.targetRange);
    setEditOpen(true);
  };

  const lowStockText = medSummary.lowStockCount
    ? `${medSummary.lowStockCount} low stock medication${medSummary.lowStockCount > 1 ? 's' : ''}`
    : 'Medication supply is healthy';

  const tightest = medSummary.tightest;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}> 
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Connected dashboard</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Live diabetes stats, timers, and medication status.</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceGlassy }]}> 
          <View style={styles.avatarWrap}>
            <Ionicons name="person-circle" size={72} color={colors.accent} />
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{profile.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>{profile.email || 'Add your profile email for reminders'}</Text>
          <View style={styles.profileMetaRow}>
            <View style={[styles.profileChip, { backgroundColor: colors.accentSoft }]}> 
              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Target</Text>
              <Text style={[styles.chipValue, { color: colors.text }]}>{profile.targetRange}</Text>
            </View>
            <View style={[styles.profileChipAlt, { backgroundColor: colors.surfaceHover }]}> 
              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Connected</Text>
              <Text style={[styles.chipValue, { color: colors.text }]}>{medSummary.medicationCount || 0} meds</Text>
            </View>
          </View>
          <Pressable style={[styles.editBtn, { backgroundColor: colors.accent }]} onPress={openEditor}>
            <Text style={styles.editBtnText}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Live metrics</Text>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <View style={styles.statGrid}>
              <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Latest reading</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{latestReading ? Math.round(latestReading.value_mgdl) : '—'}</Text>
                <Text style={[styles.statUnit, { color: colors.textSecondary }]}>{latestReading ? 'mg/dL' : 'Waiting'}</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>7-day avg</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{avg7Day ? Math.round(avg7Day) : '—'}</Text>
                <Text style={[styles.statUnit, { color: colors.textSecondary }]}>{avg7Day ? 'mg/dL' : 'No data'}</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Estimated HbA1c</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{estimatedA1c ?? '—'}</Text>
                <Text style={[styles.statUnit, { color: colors.textSecondary }]}>{estimatedA1c ? '%' : 'Based on 7 days'}</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Meal timer</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{session ? 'Active' : 'Idle'}</Text>
                <Text style={[styles.statUnit, { color: colors.textSecondary }]}>{session ? `${session.mealLabel || 'Meal'} • medicine due ${medicineLabel}` : 'No active meal timer'}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Medication status</Text>
          <View style={styles.medSummaryRow}>
            <View style={styles.medSummaryBody}>
              <Text style={[styles.medSummaryLabel, { color: colors.text }]}>{lowStockText}</Text>
              <Text style={[styles.medSummaryText, { color: colors.textSecondary }]} numberOfLines={2}>
                {tightest
                  ? `${tightest.med.name} • ${formatDaysRemaining(tightest.metrics.daysRemaining)}`
                  : medSummary.medicationCount
                  ? 'All active medications are above the low-stock threshold.'
                  : 'No medications added yet.'}
              </Text>
            </View>
            <View style={[styles.stockBadge, medSummary.lowStockCount ? styles.stockBadgeWarn : null]}> 
              <Text style={styles.stockBadgeText}>{medSummary.lowStockCount}</Text>
              <Text style={[styles.stockBadgeSub, { color: colors.textSecondary }]}>low</Text>
            </View>
          </View>
          {session ? (
            <Pressable style={[styles.timerRow, { backgroundColor: colors.accentSoft }]} onPress={clearTimers}>
              <Ionicons name="stopwatch-outline" size={18} color={colors.accent} />
              <Text style={[styles.timerAction, { color: colors.accent }]}>Stop active timer</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Accent theme</Text>
          <Text style={[styles.sectionCopy, { color: colors.textSecondary }]}>Pick a premium accent color for your DiaTrack UI.</Text>
          <View style={styles.colorRow}>
            {themePresets.map((preset) => {
              const selected = preset.color === accent;
              return (
                <Pressable
                  key={preset.key}
                  onPress={() => setAccent(preset.color)}
                  style={[
                    styles.colorChip,
                    { backgroundColor: preset.color },
                    selected && styles.colorChipSelected,
                  ]}
                >
                  {selected ? <Ionicons name="checkmark" size={18} color="#000" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, styles.quickCard, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Quick actions</Text>
          <Pressable style={styles.actionRow}>
            <Text style={[styles.actionLabel, { color: colors.text }]}>Add new glucose reading</Text>
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable style={styles.actionRow}>
            <Text style={[styles.actionLabel, { color: colors.text }]}>Review medication supply</Text>
            <Ionicons name="medkit-outline" size={20} color={colors.accent} />
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit profile</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Name"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            />
            <TextInput
              value={draftEmail}
              onChangeText={setDraftEmail}
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              keyboardType="email-address"
            />
            <TextInput
              value={draftTargetRange}
              onChangeText={setDraftTargetRange}
              placeholder="Target range"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            />
            <View style={styles.modalButtonRow}>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.surface }]} onPress={() => setEditOpen(false)}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.accent }]} onPress={saveProfile}>
                <Text style={[styles.modalButtonText, { color: '#071014' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '90%',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  profileCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#0a0c10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  profileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    marginBottom: 18,
  },
  profileChip: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 130,
  },
  profileChipAlt: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 130,
  },
  chipLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  chipValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  editBtn: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 18,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#071014',
  },
  card: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 14,
  },
  sectionCopy: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  loadingCard: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statBox: {
    flexBasis: '48%',
    minHeight: 118,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
  },
  statUnit: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  medSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  medSummaryBody: {
    flex: 1,
  },
  medSummaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  medSummaryText: {
    fontSize: 13,
    lineHeight: 20,
  },
  stockBadge: {
    minWidth: 62,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#0f131d',
    alignItems: 'center',
  },
  stockBadgeWarn: {
    backgroundColor: 'rgba(251,146,60,0.14)',
  },
  stockBadgeText: {
    fontSize: 18,
    fontWeight: '800',
  },
  stockBadgeSub: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  timerAction: {
    fontSize: 14,
    fontWeight: '700',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  colorChip: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorChipSelected: {
    borderColor: '#f1f4fa',
  },
  quickCard: {
    paddingVertical: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    width: '78%',
  },
  divider: {
    height: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 18,
  },
  modalInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 14,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalButtonPrimary: {},
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
