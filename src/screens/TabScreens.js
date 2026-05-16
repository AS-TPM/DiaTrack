import BloodSugarLogScreen from './BloodSugarLogScreen';
import MedicationsScreen from './MedicationsScreen';
import TrendsScreen from './TrendsScreen';
import MealLogScreen from './MealLogScreen';
import ProfileScreen from './ProfileScreen';

export function LogTabScreen() {
  return <BloodSugarLogScreen />;
}

export function MedsTabScreen() {
  return <MedicationsScreen />;
}

export function TrendsTabScreen() {
  return <TrendsScreen />;
}
export function MealsTabScreen() {
  return <MealLogScreen />;
}

export function ProfileTabScreen() {
  return <ProfileScreen />;
}
