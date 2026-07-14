import type { ImageSourcePropType } from 'react-native';

/** Remote URL, data URL, or bundled require() for React Native Image. */
export function imageSourceFromUrl(
  url: string | null | undefined,
  fallback: ImageSourcePropType,
): ImageSourcePropType {
  const trimmed = url?.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:') || trimmed.startsWith('file:')) {
    return { uri: trimmed };
  }
  return fallback;
}
