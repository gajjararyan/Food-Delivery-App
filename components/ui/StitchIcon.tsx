import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors } from '../../constants/theme';

export type StitchIconName =
  | 'verified'
  | 'star'
  | 'location-on'
  | 'eco'
  | 'error-outline'
  | 'local-shipping'
  | 'schedule'
  | 'restaurant'
  | 'arrow-back'
  | 'arrow-forward'
  | 'payment'
  | 'add'
  | 'more-vert'
  | 'navigation'
  | 'person'
  | 'group';

export type StitchIconProps = {
  name: StitchIconName;
  size?: number;
  color?: string;
};

/** Material Symbols–style icons used in Stitch HTML designs. */
export function StitchIcon({ name, size = 20, color = colors.onSurfaceVariant }: StitchIconProps) {
  return <MaterialIcons name={name} size={size} color={color} accessibilityElementsHidden />;
}
