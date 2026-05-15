import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors as defaultColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import {
  deleteMedication,
  insertMedication,
  listMedicationsWithSchedules,
  updateMedication,
} from '../db/medications';
import {
  computeMedicationMetrics,
  formatDaysRemaining,
  SUPPLY_BAR_TARGET_DAYS,
} from '../domain/medicationCalculations';

function parseNum(v, fallback = 0) {
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function ProgressBar({ percent, fillColor }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${p}%`, backgroundColor: fillColor }]} />
    </View>
  );
}

function MedicationEditorModal({ visible, initial, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [tabletsPerBox, setTabletsPerBox] = useState('');
  const [boxCount, setBoxCount] = useState('');
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [extras, setExtras] = useState([]);
  const { colors } = useTheme();

  const resetFromInitial = useCallback(() => {
    if (!initial) {
      setName('');
      setDosage('');
      setTabletsPerBox('');
      setBoxCount('');
      setBreakfast('');
      setLunch('');
      setDinner('');
      setExtras([]);
      return;
    }
    setName(initial.name ?? '');
    setDosage(initial.dosage ?? '');
    setTabletsPerBox(String(initial.tablets_per_box ?? ''));
    setBoxCount(String(initial.box_count ?? ''));
    setBreakfast(String(initial.breakfast_tablets ?? ''));
    setLunch(String(initial.lunch_tablets ?? ''));
    setDinner(String(initial.dinner_tablets ?? ''));
    setExtras((initial.scheduleEntries ?? []).map((e, i) => ({
      key: `e-${e.id ?? i}`,
      label: e.label ?? '',
      tablet_count: String(e.tablet_count ?? ''),
    })));
  }, [initial]);

  useEffect(() => {
    if (visible) resetFromInitial();
  }, [visible, resetFromInitial]);

  const addExtraRow = useCallback(() => {
    setExtras((prev) => [...prev, { key: `n-${Date.now()}`, label: '', tablet_count: '' }]);
  }, []);

  const removeExtraRow = useCallback((key) => {
    setExtras((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const updateExtra = useCallback((key, field, value) => {
    setExtras((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }, []);

  const handleSave = useCallback(async () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('Name required', 'Enter a medication name.');
      return;
    }
    const tpb = parseNum(tabletsPerBox, NaN);
    if (!(tpb > 0)) {
      Alert.alert('Tablets per box', 'Enter a number greater than zero.');
      return;
    }
    const boxes = parseNum(boxCount, NaN);
    if (!(boxes >= 0)) {
      Alert.alert('Boxes', 'Enter zero or more boxes on hand.');
      return;
    }

    const payload = {
      name: n,
      dosage: dosage.trim(),
      tablets_per_box: tpb,
      box_count: boxes,
      breakfast_tablets: parseNum(breakfast, 0),
      lunch_tablets: parseNum(lunch, 0),
      dinner_tablets: parseNum(dinner, 0),
    };

    const extraSlots = extras.map((e) => ({ label: e.label.trim(), tablet_count: parseNum(e.tablet_count, 0) }));

    try {
      if (initial?.id) {
        await updateMedication(initial.id, payload, extraSlots);
      } else {
        await insertMedication(payload, extraSlots);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Save failed', String(e?.message ?? e));
    }
  }, [name, dosage, tabletsPerBox, boxCount, breakfast, lunch, dinner, extras, initial, onClose, onSaved]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
       <View
  style={[
    styles.modalCard,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  ]}
>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{initial?.id ? 'Edit medication' : 'Add medication'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput style={[
  styles.input,
  {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
  },
]} value={name} onChangeText={setName} placeholder="e.g. Metformin" placeholderTextColor={colors.textSecondary} />

            <Text
  style={[
    styles.fieldLabel,
    styles.fieldSp,
    { color: colors.textSecondary },
  ]}
>
  Dosage
</Text>
            <TextInput style={[
  styles.input,
  {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
  },
]} value={dosage} onChangeText={setDosage} placeholder="e.g. 500 mg" placeholderTextColor={colors.textSecondary} />

            <View style={styles.row2}>
              <View style={styles.row2Col}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tablets / box</Text>
                <TextInput
                  style={[
  styles.input,
  {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
  },
]}
                  value={tabletsPerBox}
                  onChangeText={setTabletsPerBox}
                  keyboardType="decimal-pad"
                  placeholder="30"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={styles.row2Col}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Boxes owned</Text>
                <TextInput
                  style={[
  styles.input,
  {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
  },
]}
                  value={boxCount}
                  onChangeText={setBoxCount}
                  keyboardType="decimal-pad"
                  placeholder="2"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <Text
  style={[
    styles.fieldLabel,
    styles.fieldSp,
    { color: colors.textSecondary },
  ]}
>
  Daily schedule (tablets)
<Text
  style={[
    styles.fieldLabel,
    styles.fieldSp,
    { color: colors.textSecondary },
  ]}
>
  Daily schedule (tablets)
</Text>     <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>Breakfast, lunch, dinner • plus custom times below.</Text>Breakfast, lunch, dinner • plus custom times below.</Text>
            <View style={styles.row3}>
              <View style={styles.row3Col}>
                <Text style={[styles.miniLab, { color: colors.textSecondary }]}>Breakfast</Text>
                <TextInput style={[
  styles.input,
  {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
  },
]} value={breakfast} onChangeText={setBreakfast} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.row3Col}>
                <Text style={[styles.miniLab, { color: colors.textSecondary }]}>Lunch</Text>
                <TextInput style={[
  styles.input,
  {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
  },
]} value={lunch} onChangeText={setLunch} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.row3Col}>
                <Text style={[styles.miniLab, { color: colors.textSecondary }]}>Dinner</Text>
                <TextInput style={[
  styles.input,
  {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text,
  },
]} value={dinner} onChangeText={setDinner} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textSecondary} />
              </View>
            </View>

            <View style={styles.extraHeader}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Custom times</Text>
              <Pressable onPress={addExtraRow} style={styles.addRowBtn}>
                <Ionicons name="add" size={18} color={defaultColors.accent} />
                <Text style={styles.addRowText}>Add row</Text>
              </Pressable>
            </View>
            <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>Label (e.g. "Bedtime") and tablets for that time.</Text>

            {extras.map((row) => (
              <View key={row.key} style={styles.extraRow}>
                <TextInput
                  style={[styles.input, styles.extraLabel, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={row.label}
                  onChangeText={(t) => updateExtra(row.key, 'label', t)}
                  placeholder="Label"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  style={[styles.input, styles.extraCount, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={row.tablet_count}
                  onChangeText={(t) => updateExtra(row.key, 'tablet_count', t)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
                <Pressable onPress={() => removeExtraRow(row.key)} style={styles.trashBtn}>
                  <Ionicons name="trash-outline" size={20} color={defaultColors.high} />
                </Pressable>
              </View>
            ))}

            <Pressable onPress={handleSave} style={[styles.saveModalBtn, { backgroundColor: colors.accent }]}>
              <Text style={styles.saveModalBtnText}>Save</Text>
            </Pressable>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 80;
  const { colors } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMedicationsWithSchedules();
      setRows(list.map((med) => ({ med, metrics: computeMedicationMetrics(med, med.scheduleEntries) })));
    } catch (e) {
      console.error(e);
      Alert.alert('Could not load medications', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((med) => {
    setEditing(med);
    setEditorOpen(true);
  }, []);

  const confirmDelete = useCallback(
    (med) => {
      Alert.alert('Delete medication', `Remove "${med.name}" from your inventory?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedication(med.id);
              await load();
            } catch (e) {
              Alert.alert('Delete failed', String(e?.message ?? e));
            }
          },
        },
      ]);
    },
    [load]
  );

  const renderItem = useCallback(
    ({ item }) => {
      const { med, metrics } = item;
      const fillColor = metrics.isLowStock ? defaultColors.high : colors.accent;
      return (
        <Pressable onPress={() => openEdit(med)} style={[styles.medCard, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <View style={styles.medCardTop}>
            <View style={styles.medTitleCol}>
              <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
              {med.dosage ? <Text style={[styles.medDosage, { color: colors.textSecondary }]}>{med.dosage}</Text> : null}
            </View>
            {metrics.isLowStock ? (
              <View style={styles.lowPill}>
                <Ionicons name="warning" size={14} color={defaultColors.high} />
                <Text style={styles.lowPillText}>Low stock</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: colors.text }]}>{Math.round(metrics.totalTablets)}</Text>
              <Text style={styles.statLab}>tablets left</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: colors.text }]}>{metrics.tabletsPerDay > 0 ? metrics.tabletsPerDay.toFixed(1) : '0'}</Text>
              <Text style={styles.statLab}>per day</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: colors.text }]}>{formatDaysRemaining(metrics.daysRemaining)}</Text>
              <Text style={styles.statLab}>est. left</Text>
            </View>
          </View>

          <Text style={[styles.barCaption, { color: colors.textSecondary }]}>Supply vs {SUPPLY_BAR_TARGET_DAYS}-day horizon ({Math.round(metrics.remainingPercent)}%)</Text>
          <ProgressBar percent={metrics.supplyBarPercent} fillColor={fillColor} />

          {!metrics.hasSchedule ? <Text style={[styles.warnHint, { color: defaultColors.high }]}>Set a daily schedule to estimate days remaining.</Text> : null}

          <View style={styles.medActions}>
            <Pressable onPress={() => openEdit(med)} style={styles.linkBtn}>
              <Text style={[styles.linkBtnText, { color: colors.accent }]}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => confirmDelete(med)} style={styles.linkBtn}>
              <Text style={[styles.linkBtnText, styles.deleteText]}>Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [openEdit, confirmDelete, colors.accent]
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.screenHeader}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Medications</Text>
          <Text style={[styles.screenSub, { color: colors.textSecondary }]}>Inventory & daily schedule</Text>
        </View>
        <Pressable onPress={openAdd} style={[styles.headerAdd, { backgroundColor: colors.accent }]}> 
          <Ionicons name="add" size={22} color="#041210" />
        </Pressable>
      </View>
    ),
    [openAdd, colors.accent, colors.text, colors.textSecondary]
  );

  const empty = !loading && rows.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}> 
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.med.id)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 28 }]}
          ListEmptyComponent={
            empty ? (
              <View style={styles.emptyBox}>
                <Ionicons name="medkit-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No medications yet</Text>
                <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>Tap + to add your first medication and schedule.</Text>
              </View>
            ) : null
          }
        />
      )}

      <MedicationEditorModal
        key={editing?.id ?? 'new'}
        visible={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20 },
  screenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 18 },
  screenTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  screenSub: { marginTop: 4, fontSize: 14, fontWeight: '500' },
  headerAdd: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  medCard: { borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1 },
  medCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  medTitleCol: { flex: 1, marginRight: 8 },
  medName: { fontSize: 18, fontWeight: '700' },
  medDosage: { marginTop: 4, fontSize: 14 },
  lowPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251, 146, 60, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  lowPillText: { fontSize: 12, fontWeight: '700', color: defaultColors.high },
  statGrid: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: defaultColors.border },
  statCell: { flex: 1 },
  statVal: { fontSize: 17, fontWeight: '700' },
  statLab: { marginTop: 2, fontSize: 11, color: defaultColors.textTertiary, fontWeight: '600' },
  barCaption: { marginTop: 12, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  barTrack: { height: 8, borderRadius: 6, backgroundColor: defaultColors.background, marginTop: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6, backgroundColor: defaultColors.accent },
  warnHint: { marginTop: 8, fontSize: 12, color: defaultColors.high, fontWeight: '600' },
  medActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 12 },
  linkBtn: { paddingVertical: 4 },
  linkBtnText: { fontSize: 14, fontWeight: '700' },
  deleteText: { color: defaultColors.high },
  emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16 },
  emptyTitle: { marginTop: 14, fontSize: 18, fontWeight: '700' },
  emptyBody: { marginTop: 8, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { maxHeight: '85%', borderRadius: 22, paddingHorizontal: 18, paddingTop: 12, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  fieldSp: { marginTop: 14 },
  fieldHint: { marginTop: 4, fontSize: 12, color: defaultColors.textTertiary, lineHeight: 16 },
  input: { marginTop: 8, backgroundColor: defaultColors.background, borderRadius: 12, borderWidth: 1, borderColor: defaultColors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: defaultColors.text, fontWeight: '600' },
  row2: { flexDirection: 'row', gap: 12, marginTop: 4 },
  row2Col: { flex: 1 },
  row3: { flexDirection: 'row', gap: 8, marginTop: 8 },
  row3Col: { flex: 1 },
  miniLab: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  extraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addRowText: { fontSize: 14, fontWeight: '700', color: defaultColors.accent },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  extraLabel: { flex: 1, marginTop: 0 },
  extraCount: { width: 72, marginTop: 0, textAlign: 'center' },
  trashBtn: { padding: 8 },
  saveModalBtn: { marginTop: 22, backgroundColor: defaultColors.accent, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  saveModalBtnText: { fontSize: 16, fontWeight: '700', color: '#041210' },
});
