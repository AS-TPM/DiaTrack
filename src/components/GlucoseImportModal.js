import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { parseMySugrCsv } from '../services/mysugrCsvImport';
import { insertGlucoseReadingsBatch } from '../db/glucoseReadings';

export default function GlucoseImportModal({ visible, onClose, onImported }) {
  const [phase, setPhase] = useState('idle');
  const [message, setMessage] = useState('');
  const [imported, setImported] = useState(0);
  const [skipped, setSkipped] = useState(0);

  const reset = useCallback(() => {
    setPhase('idle');
    setMessage('');
    setImported(0);
    setSkipped(0);
  }, []);

  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose?.();
  }, [onClose, reset]);

  const pickAndImport = useCallback(async () => {
    setMessage('');
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) {
        return;
      }
      const asset = res.assets?.[0];
      if (!asset?.uri) {
        setPhase('error');
        setMessage('No file URI returned.');
        return;
      }

      setPhase('reading');
      const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });

      setPhase('parsing');
      const { readings, parseErrors } = parseMySugrCsv(text);
      if (parseErrors.length && !readings.length) {
        setPhase('error');
        setMessage(parseErrors.join('\n'));
        return;
      }

      setPhase('importing');
      const { imported: imp, skipped: sk } = await insertGlucoseReadingsBatch(readings, {
        skipDuplicates: true,
      });
      setImported(imp);
      setSkipped(sk);
      setPhase('done');
      const warn = parseErrors.length ? `\n\nNotes:\n${parseErrors.slice(0, 8).join('\n')}` : '';
      setMessage(`Imported ${imp} readings. Skipped ${sk} duplicates.${warn}`);
      onImported?.();
    } catch (e) {
      console.error(e);
      setPhase('error');
      setMessage(String(e?.message ?? e));
    }
  }, [onImported]);

  const showPickerButton = phase === 'idle' || phase === 'done' || phase === 'error';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Import glucose CSV</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.body}>
            Supports mySugr exports and similar comma/semicolon files (mg/dL). Identical timestamp + value rows are
            skipped.
          </Text>

          {showPickerButton ? (
            <Pressable style={styles.primaryBtn} onPress={pickAndImport}>
              <Ionicons name="cloud-upload-outline" size={20} color="#041210" />
              <Text style={styles.primaryBtnText}>
                {phase === 'done' || phase === 'error' ? 'Choose another file' : 'Choose CSV file'}
              </Text>
            </Pressable>
          ) : null}

          {(phase === 'reading' || phase === 'parsing' || phase === 'importing') && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>
                {phase === 'reading' && 'Reading file…'}
                {phase === 'parsing' && 'Parsing CSV…'}
                {phase === 'importing' && 'Saving to database…'}
              </Text>
            </View>
          )}

          {phase === 'done' ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultMain}>
                Imported {imported} · Skipped {skipped}
              </Text>
            </View>
          ) : null}

          {(phase === 'done' || phase === 'error') && message ? (
            <ScrollView style={styles.msgScroll}>
              <Text style={styles.msg}>{message}</Text>
            </ScrollView>
          ) : null}

          {phase === 'done' || phase === 'error' ? (
            <Pressable style={styles.secondaryBtn} onPress={handleClose}>
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#041210' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  loadingText: { marginLeft: 12, fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  resultBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
  resultMain: { fontSize: 16, fontWeight: '700', color: colors.text },
  msgScroll: { maxHeight: 160, marginTop: 12 },
  msg: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  secondaryBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.accent },
});
