import { Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
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
import { useTheme } from '../theme/ThemeContext';

const DAY_MS = 24 * 60 * 60 * 1000;
const screenWidth = Dimensions.get('window').width;

function formatDay(dayStr) {
  if (!dayStr || typeof dayStr !== 'string') return '';
  const [y, m, d] = dayStr.split('-').map(Number);
  if (!y || !m || !d) return dayStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TrendsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRange, setSelectedRange] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since =
  selectedRange === -1
    ? 0
    : Date.now() - selectedRange * DAY_MS;
      const rows = await getGlucoseDailyTrendBuckets(since);
      setBuckets(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setError(String(e?.message ?? e));
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedRange]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const chartData = useMemo(() => {
  return {
    labels: buckets.slice(-7).map((b) => formatDay(b.day)),
    datasets: [
      {
        data: buckets.slice(-7).map((b) => Number(b.avg_v) || 0),
      },
    ],
  };
}, [buckets]);

const maxBar = useMemo(() => {
  const vals = buckets.map((b) => Number(b.avg_v) || 0);
  const m = Math.max(0, ...vals);
  return Math.max(180, m * 1.1);
}, [buckets]);
const estimatedHbA1c = useMemo(() => {
  if (!buckets.length) return null;

  const vals = buckets
    .map((b) => Number(b.avg_v))
    .filter((v) => Number.isFinite(v));

  if (!vals.length) return null;

  const avg =
    vals.reduce((s, v) => s + v, 0) / vals.length;

  return {
    avgGlucose: avg.toFixed(0),
    a1c: ((avg + 46.7) / 28.7).toFixed(1),
  };
}, [buckets]);
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
  rangeRow: {
  flexDirection: 'row',
  marginBottom: 18,
  gap: 10,
},

rangeBtn: {
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 12,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
},

rangeBtnActive: {
  backgroundColor: colors.accent,
},

rangeBtnText: {
  color: colors.text,
  fontWeight: '600',
},

rangeBtnTextActive: {
  color: '#000',
},
a1cCard: {
  backgroundColor: colors.surface,
  borderRadius: 18,
  padding: 20,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: colors.border,
},

a1cTitle: {
  fontSize: 13,
  fontWeight: '700',
  color: colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
},

a1cValue: {
  marginTop: 10,
  fontSize: 42,
  fontWeight: '700',
  color: colors.accent,
  letterSpacing: -1,
},

a1cSub: {
  marginTop: 8,
  fontSize: 15,
  color: colors.text,
  fontWeight: '600',
},

a1cSub2: {
  marginTop: 4,
  fontSize: 13,
  color: colors.textSecondary,
},
});
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
        <View style={styles.rangeRow}>
  {[7, 14, 30, 90].map((days) => (
    <Pressable
      key={days}
      onPress={() => setSelectedRange(days)}
      style={[
        styles.rangeBtn,
        selectedRange === days &&
          styles.rangeBtnActive,
      ]}
    >
      <Text
        style={[
          styles.rangeBtnText,
          selectedRange === days &&
            styles.rangeBtnTextActive,
        ]}
      >
        {days}D
      </Text>
    </Pressable>
  ))}

  <Pressable
    onPress={() => setSelectedRange(-1)}
    style={[
      styles.rangeBtn,
      selectedRange === -1 &&
        styles.rangeBtnActive,
    ]}
  >
    <Text
      style={[
        styles.rangeBtnText,
        selectedRange === -1 &&
          styles.rangeBtnTextActive,
      ]}
    >
      ALL
    </Text>
  </Pressable>
</View>
{estimatedHbA1c ? (
  <View style={styles.a1cCard}>
    <Text style={styles.a1cTitle}>
      Estimated HbA1c
    </Text>

    <Text style={styles.a1cValue}>
      {estimatedHbA1c.a1c}%
    </Text>

    <Text style={styles.a1cSub}>
      Avg glucose: {estimatedHbA1c.avgGlucose} mg/dL
    </Text>

    <Text style={styles.a1cSub2}>
      Based on {selectedRange === -1
        ? 'all readings'
        : `${selectedRange} day data`}
    </Text>
  </View>
) : null}
          <Text style={styles.section}>Daily average (mg/dL)</Text>
          <LineChart
  data={chartData}
  width={screenWidth - 40}
  height={220}
  yAxisSuffix=""
  withInnerLines={false}
  withOuterLines={true}
  withShadow={false}
  fromZero={false}
  chartConfig={{
    backgroundColor: colors.surface,
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 212, 170, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`,
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: colors.accent,
    },
  }}
  bezier
  style={{
    marginBottom: 24,
    borderRadius: 16,
  }}
/>
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
                    avg {avg.toFixed(0)} · min {Number.isFinite(minV) ? minV.toFixed(0) : '—'} · max{' '}
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


