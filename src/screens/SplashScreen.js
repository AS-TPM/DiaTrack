import { View, Text, StyleSheet, Image } from 'react-native';
import { useEffect } from 'react';
export default function SplashScreen({ navigation }) {
    useEffect(() => {
  const t = setTimeout(() => {
    navigation.replace('Main');
  }, 1800);

  return () => clearTimeout(t);
}, []);
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
      />

      <Text style={styles.title}>
        DiaTrack
      </Text>

      <Text style={styles.subtitle}>
        Smart glucose tracking
      </Text>
      <Text style={styles.branding}>
        Made By ASTPM
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },

  title: {
    marginTop: 28,
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#9CA3AF',
  },

  branding: {
    marginTop: 10,
    fontSize: 12,
    color: '#9CA3AF',
  },
});