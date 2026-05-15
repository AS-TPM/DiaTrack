import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
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

const Tab = createMaterialTopTabNavigator();
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
          tabBarShowLabel: false,
          tabBarAllowFontScaling: false,
  swipeEnabled: true,
  animationEnabled: false,

  tabBarPosition: 'bottom',
  tabBarShowIcon: true,

  tabBarPressColor: 'transparent',

  sceneContainerStyle: {
    backgroundColor: colors.background,
  },

  tabBarStyle: {
    position: 'absolute',
    paddingBottom: 0,
    left: 14,
    right: 14,
    bottom: 18,

    height: 58,
    borderRadius: 28,

    overflow: 'hidden',

    backgroundColor: colors.surfaceGlassy,

    borderWidth: 1,
    borderColor: colors.border,

    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 10,
  },

  tabBarIndicatorStyle: {
    height: '40',
    top: 6,
    borderRadius: 200,
    marginHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 7,
  },

 tabBarItemStyle: {
  justifyContent: 'center',
  alignItems: 'center',
},

  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.tabInactive,

  tabBarLabelStyle: {
  fontSize: 10,
  fontWeight: '700',
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
