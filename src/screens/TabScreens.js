import PlaceholderScreen from './PlaceholderScreen';
import BloodSugarLogScreen from './BloodSugarLogScreen';
import MedicationsScreen from './MedicationsScreen';
import TrendsScreen from './TrendsScreen';

export function LogTabScreen() {
  return <BloodSugarLogScreen />;
}

export function MedsTabScreen() {
  return <MedicationsScreen />;
}

export function TrendsTabScreen() {
  return <TrendsScreen />;
}

export function ProfileTabScreen() {
  return (
    <PlaceholderScreen
      title="Profile"
      icon="person"
      subtitle="Targets, devices, and account settings."
    />
  );
}
