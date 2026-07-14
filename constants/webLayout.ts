import { Platform, type ViewStyle } from 'react-native';
import { colors } from './theme';

/** Shared full-viewport styles for React Native Web. */
export const webRootStyle: ViewStyle = Platform.select({
  web: {
    width: '100%',
    maxWidth: '100vw',
    minHeight: '100vh',
    overflow: 'hidden',
  },
  default: {},
}) as ViewStyle;

export const webScreenStyle: ViewStyle = {
  flex: 1,
  width: '100%',
  backgroundColor: colors.background,
  ...webRootStyle,
};

/** Center the mobile shell on wide desktop browsers. */
export const webPageStyle: ViewStyle = Platform.select({
  web: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  default: {
    flex: 1,
    width: '100%',
  },
}) as ViewStyle;
