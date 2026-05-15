import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { colors as defaultColors, getThemeColors, themePresets } from './colors';

const STORAGE_KEY = '@diatrack/theme_v1';

const ThemeContext = createContext({
  colors: defaultColors,
  accent: defaultColors.accent,
  setAccent: () => {},
  themePresets,
});

export function ThemeProvider({ children }) {
  const [accent, setAccentState] = useState(defaultColors.accent);
  const [colors, setColors] = useState(getThemeColors(defaultColors.accent));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (parsed?.accent) {
          setAccentState(parsed.accent);
          setColors(getThemeColors(parsed.accent));
        }
      })
      .catch(() => {
        // ignore storage failures
      });
  }, []);

  const setAccent = useCallback(async (nextAccent) => {
    setAccentState(nextAccent);
    setColors(getThemeColors(nextAccent));
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ accent: nextAccent }));
    } catch (_error) {
      // ignore storage failures
    }
  }, []);

  const value = useMemo(
    () => ({ colors, accent, setAccent, themePresets }),
    [colors, accent, setAccent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
