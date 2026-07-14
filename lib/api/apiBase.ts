import Constants from 'expo-constants';

const UNRESOLVED = '${EXPO_PUBLIC_API_URL}';

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function isUsableApiUrl(url: string): boolean {
  if (!url) return false;
  if (url === UNRESOLVED) return false;
  if (url.includes('your-render')) return false;
  return true;
}

/**
 * Express API base URL for OTP proxy, payments, and tracking.
 * Falls back to localhost:3001 in dev when Metro env inlining is missing.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (isUsableApiUrl(fromEnv)) {
    return normalizeBase(fromEnv);
  }

  const extra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof extra === 'string' && isUsableApiUrl(extra)) {
    return normalizeBase(extra);
  }

  // Metro sometimes omits EXPO_PUBLIC_* on web — never POST to the Expo dev server (8081).
  const isDevRuntime =
    process.env.NODE_ENV !== 'test' &&
    process.env.NODE_ENV !== 'production' &&
    (typeof __DEV__ === 'undefined' || __DEV__);

  if (isDevRuntime) {
    return 'http://localhost:3001';
  }

  return '';
}
