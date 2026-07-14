import { Platform } from 'react-native';
import { err, ok, type Result } from '../result';
import { isSupabaseConfigured, supabase } from '../supabase';
import { logger } from '../logger';

const BUCKET = 'kitchen-photos';
const MAX_BYTES = 5 * 1024 * 1024;

function extensionForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

async function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob; mime: string }> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return { blob, mime: blob.type || 'image/jpeg' };
}

/** Upload a blob/file to public kitchen-photos and return its HTTPS URL. */
export async function uploadKitchenImageBlob(
  blob: Blob,
  folder = 'kitchen',
): Promise<Result<string>> {
  if (!isSupabaseConfigured) {
    return err('UNKNOWN', 'Supabase is required to host kitchen photos');
  }
  if (blob.size > MAX_BYTES) {
    return err('VALIDATION', 'Image is too large — use a photo under 5 MB');
  }

  const mime = blob.type || 'image/jpeg';
  if (!mime.startsWith('image/')) {
    return err('VALIDATION', 'Please choose an image file');
  }

  const path = `${folder}/${crypto.randomUUID()}.${extensionForMime(mime)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    logger.error('uploadKitchenImageBlob failed', error);
    return err('UNKNOWN', error.message || 'Could not upload photo', error);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return err('UNKNOWN', 'Upload succeeded but public URL is missing');
  }
  return ok(data.publicUrl);
}

/** Turn a local data URL into a hosted public URL (required for Discover). */
export async function persistImageUrl(url: string | null | undefined): Promise<Result<string | null>> {
  const trimmed = url?.trim() || null;
  if (!trimmed) return ok(null);
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return ok(trimmed);
  if (!trimmed.startsWith('data:')) {
    return err('VALIDATION', 'Use Upload photo or a https:// image link');
  }

  try {
    const { blob } = await dataUrlToBlob(trimmed);
    return uploadKitchenImageBlob(blob);
  } catch (cause) {
    return err('UNKNOWN', cause instanceof Error ? cause.message : 'Could not process photo', cause);
  }
}

/**
 * Web file picker — uploads to Supabase Storage and returns a public https URL.
 * Does not keep local-only data URLs (those never appear on the public chef page).
 */
export async function pickAndHostKitchenImage(folder = 'kitchen'): Promise<Result<string>> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return err('UNKNOWN', 'Photo upload is available on web for now');
  }

  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });

  if (!file) return err('VALIDATION', 'No photo selected');
  if (!isSupabaseConfigured) {
    return err('UNKNOWN', 'Supabase is required to host kitchen photos');
  }

  return uploadKitchenImageBlob(file, folder);
}
