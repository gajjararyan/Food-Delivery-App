import { Redirect, type Href } from 'expo-router';

export default function ChefIndex() {
  return <Redirect href={'/(chef)/(tabs)/' as Href} />;
}
