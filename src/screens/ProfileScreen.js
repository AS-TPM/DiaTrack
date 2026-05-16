import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { getLatestGlucoseReading } from '../db/glucoseReadings';
import { listMedicationsWithSchedules } from '../db/medications';
import {
  computeMedicationMetrics,
  summarizeInventory,
  formatDaysRemaining,
} from '../domain/medicationCalculations';

const PROFILE_STORAGE_KEY = '@diatrack/profile_v2';
const DEFAULT_PROFILE = {
  name: 'Your name',
  age: '',
  diabetesType: 'Type 1',
  email: '',
  targetRange: '70 - 130 mg/dL',
  emergencyContact: '',
  emergencyPhone: '',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [draft, setDraft] = useState(DEFAULT_PROFILE);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [medSummary, setMedSummary] = useState({ medicationCount: 0, lowStockCount: 0, tightest: null });
  const [latestReading, setLatestReading] = useState(null);

  const appVersion = Constants.manifest?.version || Constants.nativeAppVersion || '1.0.0';

  const loadProfile = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) {
        setProfile(DEFAULT_PROFILE);
        return;
      }
      setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) });
    } catch (error) {
      console.warn('Failed to load profile', error);
    }
  }, []);

  const saveProfile = useCallback(async () => {
    try {
      const next = {
        name: draft.name.trim() || DEFAULT_PROFILE.name,
        age: draft.age.trim(),
        diabetesType: draft.diabetesType.trim() || DEFAULT_PROFILE.diabetesType,
        email: draft.email.trim(),
        targetRange: draft.targetRange.trim() || DEFAULT_PROFILE.targetRange,
        emergencyContact: draft.emergencyContact.trim(),
        emergencyPhone: draft.emergencyPhone.trim(),
      };
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
      setProfile(next);
      setEditOpen(false);
    } catch (error) {
      console.warn('Failed to save profile', error);
    }
  }, [draft]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      await loadProfile();
      const [latest, meds] = await Promise.all([getLatestGlucoseReading(), listMedicationsWithSchedules()]);
      setLatestReading(latest ?? null);
      const rows = meds.map((med) => ({ med, metrics: computeMedicationMetrics(med, med.scheduleEntries) }));
      setMedSummary(summarizeInventory(rows));
    } catch (error) {
      console.warn('Failed to load profile summary', error);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const openEdit = useCallback(() => {
    setDraft(profile);
    setEditOpen(true);
  }, [profile]);

  const emergencyCall = useCallback(async () => {
    if (!profile.emergencyPhone) return;
    const tel = `tel:${profile.emergencyPhone.replace(/\s+/g, '')}`;
    try {
      await Linking.openURL(tel);
    } catch (error) {
      console.warn('Emergency call failed', error);
    }
  }, [profile.emergencyPhone]);

  const medicationText = medSummary.medicationCount
    ? `${medSummary.medicationCount} medication${medSummary.medicationCount !== 1 ? 's' : ''}`
    : 'No medication yet';

  const emergencyText = profile.emergencyContact
    ? `${profile.emergencyContact}${profile.emergencyPhone ? ` • ${profile.emergencyPhone}` : ''}`
    : 'Add an emergency contact for fast access.';

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.surfaceGlassy, borderColor: colors.border }]}> 
          <Ionicons name="person-circle" size={84} color={colors.accent} />
          <Text style={[styles.name, { color: colors.text }]}>{profile.name}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{profile.diabetesType || 'Diabetes type not set'}</Text>
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: colors.surface }]}> 
              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Age</Text>
              <Text style={[styles.chipValue, { color: colors.text }]}>{profile.age || '—'}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.surface }]}> 
              <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Target</Text>
              <Text style={[styles.chipValue, { color: colors.text }]}>{profile.targetRange}</Text>
            </View>
          </View>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={openEdit}>
            <Text style={[styles.actionText, { color: '#071014' }]}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Medication summary</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={[styles.cardValue, { color: colors.text }]}>{medicationText}</Text>
          )}
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Low supply: {medSummary.lowStockCount}</Text>
          {medSummary.tightest ? (
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Most urgent: {medSummary.tightest.med.name} • {formatDaysRemaining(medSummary.tightest.metrics.daysRemaining)} left</Text>
          ) : null}
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Emergency contact</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>{emergencyText}</Text>
          <Pressable style={[styles.callBtn, { backgroundColor: profile.emergencyPhone ? colors.accent : colors.surface }]} onPress={emergencyCall} disabled={!profile.emergencyPhone}>
            <Ionicons name="call-outline" size={18} color={profile.emergencyPhone ? '#071014' : colors.textSecondary} />
            <Text style={[styles.callText, { color: profile.emergencyPhone ? '#071014' : colors.textSecondary }]}>{profile.emergencyPhone ? 'Call emergency' : 'No phone configured'}</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Latest reading</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>{latestReading ? `${Math.round(latestReading.value_mgdl)} mg/dL` : 'No recent reading'}</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Data syncs from Log and Dashboard imports.</Text>
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceGlassy }]}> 
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>App info</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>{`DiaTrack · v${appVersion}`}</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Premium dark glass UI, glucose notes, medication planning, and timers.</Text>
        </View>

        <View style={styles.brandingWrap}>
          <Text style={[styles.branding, { color: colors.textSecondary }]}>Made By ASTPM</Text>
        </View>
      </ScrollView>

      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit profile</Text>
            <TextInput
              value={draft.name}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, name: text }))}
              placeholder="Name"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={draft.age}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, age: text }))}
              placeholder="Age"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={draft.diabetesType}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, diabetesType: text }))}
              placeholder="Diabetes type"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={draft.targetRange}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, targetRange: text }))}
              placeholder="Target glucose range"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={draft.emergencyContact}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, emergencyContact: text }))}
              placeholder="Emergency contact name"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <TextInput
              value={draft.emergencyPhone}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, emergencyPhone: text }))}
              placeholder="Emergency phone"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            />
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.surface }]} onPress={() => setEditOpen(false)}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, { backgroundColor: colors.accent }]} onPress={saveProfile}>
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
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  hero: {
    borderRadius: 28,
    padding: 24,
    marginTop: 18,
    marginBottom: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  name: { marginTop: 18, fontSize: 28, fontWeight: '800' },
  sub: { marginTop: 8, fontSize: 14, color: '#9aa8b5', textAlign: 'center' },
  chipRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  chip: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, minWidth: 110 },
  chipLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  chipValue: { marginTop: 4, fontSize: 16, fontWeight: '800' },
  actionBtn: { marginTop: 20, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24 },
  actionText: { fontSize: 15, fontWeight: '800' },
  card: { borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  cardValue: { fontSize: 18, fontWeight: '800' },
  cardMeta: { marginTop: 8, fontSize: 13, lineHeight: 20 },
  callBtn: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: 'transparent' },
  callText: { fontSize: 14, fontWeight: '700' },
  brandingWrap: { marginTop: 24, alignItems: 'center' },
  branding: { fontSize: 12, letterSpacing: 0.8 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 18 },
  input: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, marginBottom: 14 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalButton: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  modalButtonText: { fontSize: 15, fontWeight: '700' },
});
