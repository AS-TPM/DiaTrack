/** Dark palette for DiaTrack */
function hexToRgb(hex) {
  const cleaned = String(hex).replace('#', '').trim();
  const full = cleaned.length === 3
    ? cleaned.split('').map((ch) => ch + ch).join('')
    : cleaned;

  const int = parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) {
    return null;
  }

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export const baseColors = {
  background: '#07080c',
  surface: '#11141c',
  surfaceHover: '#171b26',
  surfaceGlassy: 'rgba(17, 20, 28, 0.88)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  text: '#f1f4fa',
  textSecondary: '#8b95a8',
  textTertiary: '#5c6575',
  inRange: '#6ee7b7',
  high: '#fb923c',
  low: '#60a5fa',
  ateCta: '#f59e0b',
  ateCtaPressed: '#d97706',
  tabBar: '#0a0c10',
  tabInactive: '#6b7280',
};

export const themePresets = [
  { key: 'teal', label: 'Teal', color: '#5ee6d0' },
  { key: 'blue', label: 'Blue', color: '#60a5fa' },
  { key: 'purple', label: 'Purple', color: '#c084fc' },
  { key: 'green', label: 'Green', color: '#34d399' },
  { key: 'orange', label: 'Orange', color: '#f59e0b' },
  { key: 'red', label: 'Red', color: '#f87171' },
];

export function getThemeColors(accent = '#5ee6d0') {
  return {
    ...baseColors,
    accent,
    accentSoft: withAlpha(accent, 0.18),
    accentFaint: withAlpha(accent, 0.08),
    tabActive: accent,
    surfaceGlow: withAlpha(accent, 0.12),
  };
}

export const colors = getThemeColors();
