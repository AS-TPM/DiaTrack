import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { Snackbar } from 'react-native-paper';
import {
  getMealLogs,
  deleteMealLog,
  restoreMealLog,
} from '../db/mealLogs';
import { useTheme } from '../theme/ThemeContext';

const mealIcons = {
  breakfast: 'sunny-outline',
  lunch: 'partly-sunny-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
  custom: 'restaurant-outline',
};

function formatTime(ts) {
  return new Date(ts).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function MealLogScreen() {
  const [snackVisible, setSnackVisible] = useState(false);
  const [deletedLog, setDeletedLog] = useState(null);  
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const { colors } = useTheme();

  const loadLogs = useCallback(async () => {
    try {
      const data = await getMealLogs();
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

async function onRefresh() {
  setRefreshing(true);
  await loadLogs();
  setRefreshing(false);
}

async function handleDelete(log) {
    await Haptics.notificationAsync(
  Haptics.NotificationFeedbackType.Warning
);
  setDeletedLog(log);

  await deleteMealLog(log.id);

  await loadLogs();

  setSnackVisible(true);
}

  return (
    <ScrollView
      style={[
        styles.root,
        { backgroundColor: colors.background },
      ]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      <Text
        style={[
          styles.header,
          { color: colors.text },
        ]}
      >
        Meal Logs
      </Text>

      {logs.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name="restaurant-outline"
            size={32}
            color={colors.accent}
          />

          <Text
            style={[
              styles.emptyTitle,
              { color: colors.text },
            ]}
          >
            No meals logged yet
          </Text>

          <Text
            style={[
              styles.emptySub,
              { color: colors.textSecondary },
            ]}
          >
            Start a meal timer to begin tracking meal history.
          </Text>
        </View>
      ) : (
        logs.map((log) => (
          <Pressable
  key={log.id}
  onLongPress={() => handleDelete(log)}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.row}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: `${colors.accent}18`,
                  },
                ]}
              >
                <Ionicons
                  name={
                    mealIcons[log.meal_type] ||
                    'restaurant-outline'
                  }
                  size={22}
                  color={colors.accent}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.mealTitle,
                    { color: colors.text },
                  ]}
                >
                  {log.meal_label}
                </Text>

                <Text
                  style={[
                    styles.mealTime,
                    { color: colors.textSecondary },
                  ]}
                >
                  {formatTime(log.started_at)}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text
                style={[
                  styles.metaText,
                  { color: colors.textSecondary },
                ]}
              >
                🍽 Type: {log.meal_type}
              </Text>

              <Text
                style={[
                  styles.metaText,
                  { color: colors.textSecondary },
                ]}
              >
                💊 {log.medication_count} meds
              </Text>
            </View>

            <Text
              style={[
                styles.glucoseTime,
                { color: colors.accent },
              ]}
            >
              Glucose reminder: {formatTime(log.glucose_check_time)}
            </Text>
          </Pressable>
        ))
      )}
      <Snackbar
  visible={snackVisible}
  onDismiss={() => setSnackVisible(false)}
  duration={4000}
  action={{
    label: 'Undo',
    onPress: async () => {
      if (deletedLog) {
        await restoreMealLog(deletedLog);
        await loadLogs();
      }
    },
  }}
>
  Meal log deleted
</Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 20,
  },

  card: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  mealTitle: {
    fontSize: 18,
    fontWeight: '800',
  },

  mealTime: {
    marginTop: 4,
    fontSize: 13,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  metaText: {
    fontSize: 13,
  },

  glucoseTime: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
  },

  emptyCard: {
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    alignItems: 'center',
  },

  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
  },

  emptySub: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});