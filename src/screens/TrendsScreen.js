import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getGlucoseDailyTrendBuckets } from '../db/glucoseReadings';
import { colors } from '../theme/colors';

const RANGE_MS = 30 * 24 * 60 * 60 * 1000;

function formatDay(dayStr) {
  if (!dayStr || typeof dayStr !== 'string') return '';
  const [y, m, d] = dayStr.split('-').map(Number);
  if (!y || !m || !d) return dayStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TrendsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = Date.now() - RANGE_MS;
      const rows = await getGlucoseDailyTrendBuckets(since);
      setBuckets(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setError(String(e?.message ?? e));
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const maxBar = useMemo(() => {
    const vals = buckets.map((b) => Number(b.avg_v) || 0);
    const m = Math.max(0, ...vals);
    return Math.max(180, m * 1.1);
  }, [buckets]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trends</Text>
          <Text style={styles.sub}>Last 30 days · daily averages from your log</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Home')} hitSlop={12}>
          <Ionicons name="home-outline" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.centerPad}>
          <Text style={styles.err}>{error}</Text>
          <Pressable onPress={load} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : buckets.length === 0 ? (
        <View style={styles.centerPad}>
          <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No glucose data in this range</Text>
          <Text style={styles.emptyBody}>
            Add readings in Log or import a CSV from the Dashboard to see trends here.
          </Text>
          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.linkText}>Go to Dashboard</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.section}>Daily average (mg/dL)</Text>
          {buckets.map((b) => {
            const avg = Number(b.avg_v);
            const h = Number.isFinite(avg) ? Math.min(100, (avg / maxBar) * 100) : 0;
            const minV = Number(b.min_v);
            const maxV = Number(b.max_v);
            return (
              <View key={String(b.day)} style={styles.row}>
                <Text style={styles.dayLab}>{formatDay(b.day)}</Text>
                <View style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${h}%` }]} />
                  </View>
                  <Text style={styles.rowMeta}>
                    avg {avg.toFixed(0)} · min                     {Number.isFinite(minV) ? minV.toFixed(0) : '—'} · max{' '}
                    {Number.isFinite(maxV) ? maxV.toFixed(0) : '—'} · {Number(b.cnt)} readings
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  sub: { marginTop: 4, fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerPad: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  err: { color: colors.high, textAlign: 'center', fontSize: 14 },
  retry: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  emptyTitle: { marginTop: 14, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkBtn: { marginTop: 18 },
  linkText: { fontSize: 15, fontWeight: '700', color: colors.accent },
  scroll: { paddingHorizontal: 20 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  dayLab: { width: 56, fontSize: 13, fontWeight: '600', color: colors.textSecondary, paddingTop: 4 },
  barCol: { flex: 1 },
  barTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  rowMeta: { marginTop: 6, fontSize: 12, color: colors.textTertiary, fontWeight: '500' },
});
