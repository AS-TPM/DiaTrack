import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from './src/screens/DashboardScreen';
import SplashScreen from './src/screens/SplashScreen';
import {
  LogTabScreen,
  MedsTabScreen,
  TrendsTabScreen,
  MealsTabScreen,
  ProfileTabScreen,
} from './src/screens/TabScreens';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['diatrack://'],
  config: {
    screens: {
      Home: 'home',
      Log: 'log',
      Meds: 'meds',
      Trends: 'trends',
      Profile: 'profile',
    },
  },
};
function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 12,
            height: 64,
            borderRadius: 28,
            backgroundColor: colors.surfaceGlassy,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOpacity: 0.16,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
          },
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.5,
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={DashboardScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Log"
          component={LogTabScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Meds"
          component={MedsTabScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="medkit-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Trends"
          component={TrendsTabScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trending-up" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
  name="Meals"
  component={MealsTabScreen}
  options={{
    tabBarIcon: ({ color, size }) => (
      <Ionicons
        name="restaurant-outline"
        size={size}
        color={color}
      />
    ),
  }}
/>
        <Tab.Screen
          name="Profile"
          component={ProfileTabScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
        );
}
function NavigationRoot() {
  const { colors } = useTheme();
  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.tabBar,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
  <StatusBar style="light" />

  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen
      name="Splash"
      component={SplashScreen}
    />

    <Stack.Screen
      name="Main"
      component={MainTabs}
    />
  </Stack.Navigator>
</NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
