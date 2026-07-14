import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors } from '../../constants/theme';

type IconName =
  | 'dashboard'
  | 'restaurant-menu'
  | 'receipt-long'
  | 'home'
  | 'inventory-2'
  | 'event'
  | 'person'
  | 'assignment'
  | 'storefront';

type Props = {
  name: IconName;
  focused: boolean;
  size?: number;
};

/** Bottom tab icon — Material style for web + native. */
export function TabBarIcon({ name, focused, size = 22 }: Props) {
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={focused ? colors.primary : colors.onSurfaceVariant}
      accessibilityElementsHidden
    />
  );
}
