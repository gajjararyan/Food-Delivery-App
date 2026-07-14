import { Redirect, type Href } from 'expo-router';

export default function AdminIndex() {
  return <Redirect href={'/(admin)/(tabs)/' as Href} />;
}
