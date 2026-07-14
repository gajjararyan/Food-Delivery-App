import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ErrorState, LoadingState } from '../../../components/ui';
import { colors, radius, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { getOrder } from '../../../lib/api/orders';
import { getReviewForOrder, submitReview } from '../../../lib/api/reviews';
import { AnalyticsEvents, trackEvent } from '../../../lib/analytics';

/** Stitch: Rate & Review Your Meal (a19ac3584c40438c9d8654cb11d25ff3) */
export default function ReviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const id = typeof orderId === 'string' ? orderId : '';
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const orderQuery = useQuery({
    queryKey: ['order', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const result = await getOrder(id, user?.id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  const existingQuery = useQuery({
    queryKey: ['review', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const result = await getReviewForOrder(id);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  if (orderQuery.isLoading || existingQuery.isLoading) {
    return <LoadingState label="Loading…" />;
  }
  if (orderQuery.isError || !orderQuery.data) {
    return <ErrorState message={orderQuery.error?.message ?? 'Order not found'} />;
  }

  if (existingQuery.data || done) {
    const kitchen =
      (orderQuery.data?.thali_snapshot?.kitchenName as string | undefined) ?? 'the kitchen';
    return (
      <View style={styles.safe}>
        <Text style={styles.title}>Thanks for rating</Text>
        <Text style={styles.sub}>Your feedback helps {kitchen}.</Text>
        <Button label="Back to orders" onPress={() => router.replace('/(customer)/(tabs)/orders')} />
      </View>
    );
  }

  const onSubmit = async () => {
    if (!user) {
      setError('Sign in required');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await submitReview({
      customerId: user.id,
      orderId: id,
      makerId: orderQuery.data.maker_id,
      rating,
      comment,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    trackEvent(AnalyticsEvents.submitReview, { rating, orderId: id });
    void queryClient.invalidateQueries({ queryKey: ['reviews'] });
    void queryClient.invalidateQueries({ queryKey: ['review'] });
    void queryClient.invalidateQueries({ queryKey: ['maker'] });
    void queryClient.invalidateQueries({ queryKey: ['makers'] });
    setDone(true);
  };

  return (
    <View style={styles.safe}>
      <Text style={styles.title}>Rate your meal</Text>
      <Text style={styles.sub}>
        {(orderQuery.data.thali_snapshot?.menuName as string) ?? 'Your thali'}
      </Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            key={value}
            onPress={() => setRating(value)}
            accessibilityRole="button"
            accessibilityLabel={`${value} stars`}
          >
            <Text style={[styles.star, value <= rating && styles.starOn]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Tell Nani what you loved…"
        placeholderTextColor={colors.outline}
        multiline
        value={comment}
        onChangeText={setComment}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Submit review" loading={loading} onPress={() => void onSubmit()} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.margin,
    gap: spacing.base,
  },
  title: { ...typography.headlineMd, color: colors.onBackground },
  sub: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  stars: { flexDirection: 'row', gap: spacing.sm },
  star: { fontSize: 36, color: colors.outlineVariant },
  starOn: { color: colors.secondary },
  input: {
    ...typography.bodyMd,
    minHeight: 100,
    textAlignVertical: 'top',
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    color: colors.onSurface,
  },
  error: { ...typography.bodySm, color: colors.error },
});
