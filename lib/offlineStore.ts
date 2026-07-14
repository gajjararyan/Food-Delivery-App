import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

/** Tiny JSON blob persistence for offline (non-Supabase) fallbacks. */
export async function readJsonMap<T>(key: string): Promise<Map<string, T>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, T>;
    return new Map(Object.entries(parsed));
  } catch (cause) {
    logger.warn(`readJsonMap ${key} failed`, cause);
    return new Map();
  }
}

export async function writeJsonMap<T>(key: string, map: Map<string, T>): Promise<void> {
  try {
    const obj = Object.fromEntries(map.entries());
    await AsyncStorage.setItem(key, JSON.stringify(obj));
  } catch (cause) {
    logger.warn(`writeJsonMap ${key} failed`, cause);
  }
}
