import { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Button, Input } from '../ui';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { imageSourceFromUrl } from '../../lib/images/resolveImageSource';
import { pickAndHostKitchenImage } from '../../lib/images/uploadKitchenImage';

type Props = {
  label: string;
  hint?: string;
  value: string;
  fallback: ImageSourcePropType;
  aspectRatio?: number;
  rounded?: boolean;
  folder?: string;
  onChange: (url: string) => void;
};

/** Chef uploads a photo (hosted on Supabase) or pastes an https image URL. */
export function KitchenPhotoField({
  label,
  hint,
  value,
  fallback,
  aspectRatio = 1,
  rounded = false,
  folder = 'kitchen',
  onChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const source = imageSourceFromUrl(value, fallback);

  const onUpload = async () => {
    setUploading(true);
    setUploadError(null);
    const result = await pickAndHostKitchenImage(folder);
    setUploading(false);
    if (!result.ok) {
      if (result.error.message !== 'No photo selected') {
        setUploadError(result.error.message);
      }
      return;
    }
    onChange(result.data);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={[styles.previewWrap, rounded && styles.previewRound, { aspectRatio }]}>
        <Image source={source} style={styles.preview} resizeMode="cover" />
      </View>
      <Input
        label="Image URL"
        value={value}
        onChangeText={(text) => {
          setUploadError(null);
          onChange(text);
        }}
        placeholder="Uploads fill this automatically"
      />
      <View style={styles.actions}>
        <Button
          label={uploading ? 'Uploading…' : 'Upload photo'}
          variant="outline"
          loading={uploading}
          onPress={() => void onUpload()}
        />
        {value ? (
          <Button
            label="Remove"
            variant="ghost"
            disabled={uploading}
            onPress={() => {
              setUploadError(null);
              onChange('');
            }}
          />
        ) : null}
      </View>
      {value.startsWith('https://') ? (
        <Text style={styles.ok}>Photo saved for your public chef page.</Text>
      ) : null}
      {uploadError ? <Text style={styles.error}>{uploadError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { ...typography.labelMd, color: colors.onSurface },
  hint: { ...typography.bodySm, color: colors.onSurfaceVariant },
  previewWrap: {
    width: '100%',
    maxWidth: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  previewRound: {
    width: 120,
    height: 120,
    maxWidth: 120,
    borderRadius: radius.full,
  },
  preview: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ok: { ...typography.bodySm, color: colors.tertiary },
  error: { ...typography.bodySm, color: colors.error },
});
