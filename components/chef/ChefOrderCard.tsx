import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card } from '../ui';
import { colors, spacing, typography } from '../../constants/theme';
import type { Order, ThaliComponent, Uuid } from '../../lib/types';
import { formatInr } from '../../lib/date';
import { formatServingLabel, type ServingUnit } from '../../lib/servingSize';
import { isIncludedComponent } from '../../lib/thaliComponents';
import {
  chefNextActionLabel,
  orderStatusLabel,
} from '../../lib/orderStatus';

type SnapshotComponent = Pick<
  ThaliComponent,
  | 'id'
  | 'name'
  | 'serving_amount'
  | 'serving_unit'
  | 'included_qty'
  | 'component_type'
  | 'has_jain_variant'
  | 'jain_substitute'
>;

type OrderSnapshot = {
  menuName: string;
  applyJain: boolean;
  fulfillmentMode: 'delivery' | 'takeaway';
  deliveryAddress: string | null;
  customerName: string | null;
  cookingInstructions: string | null;
  quantities: Record<string, number>;
  components: SnapshotComponent[];
};

type Props = {
  order: Order;
  onAccept?: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  onAdvance?: () => void | Promise<void>;
  busy?: boolean;
};

function readSnapshot(order: Order): OrderSnapshot {
  const snap = order.thali_snapshot ?? {};
  const fulfillmentMode =
    snap.fulfillmentMode === 'delivery' ? 'delivery' : 'takeaway';
  const components = Array.isArray(snap.components)
    ? (snap.components as SnapshotComponent[])
    : [];
  const quantities =
    snap.quantities && typeof snap.quantities === 'object'
      ? (snap.quantities as Record<string, number>)
      : {};

  return {
    menuName: typeof snap.menuName === 'string' ? snap.menuName : 'Thali',
    applyJain: Boolean(snap.applyJain),
    fulfillmentMode,
    deliveryAddress:
      typeof snap.deliveryAddress === 'string' && snap.deliveryAddress.trim()
        ? snap.deliveryAddress.trim()
        : null,
    // Profile display name only — never expose phone to the cook UI.
    customerName:
      typeof snap.customerName === 'string' && snap.customerName.trim()
        ? snap.customerName.trim()
        : null,
    cookingInstructions:
      typeof snap.cookingInstructions === 'string' && snap.cookingInstructions.trim()
        ? snap.cookingInstructions.trim()
        : null,
    quantities,
    components,
  };
}

function customerLabel(snap: OrderSnapshot): string {
  return snap.customerName || 'Customer';
}

function lineLabel(component: SnapshotComponent, qty: number, applyJain: boolean): string {
  const name =
    applyJain && component.has_jain_variant && component.jain_substitute
      ? component.jain_substitute
      : component.name;
  const serving = formatServingLabel(
    Number(component.serving_amount) || 1,
    (component.serving_unit as ServingUnit) || 'piece',
  );
  return `${qty} × ${name} (${serving})`;
}

/** Chef-facing order card with full thali breakdown + delivery address when needed. */
export function ChefOrderCard({ order, onAccept, onReject, onAdvance, busy }: Props) {
  const snap = readSnapshot(order);
  const nextLabel = chefNextActionLabel(order.status, snap.fulfillmentMode);
  const needsAccept = order.status === 'placed';
  const isDelivery = snap.fulfillmentMode === 'delivery';

  const plateLines = snap.components
    .filter((c) => isIncludedComponent(c))
    .map((c) => {
      const qty = Number(snap.quantities[c.id as Uuid] ?? c.included_qty ?? 0);
      return { id: c.id, label: lineLabel(c, qty, snap.applyJain), qty };
    })
    .filter((row) => row.qty > 0);

  const addonLines = snap.components
    .filter((c) => !isIncludedComponent(c))
    .map((c) => {
      const qty = Number(snap.quantities[c.id as Uuid] ?? 0);
      return { id: c.id, label: lineLabel(c, qty, snap.applyJain), qty };
    })
    .filter((row) => row.qty > 0);

  return (
    <Card elevated style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{snap.menuName}</Text>
        <Badge
          label={orderStatusLabel(order.status, snap.fulfillmentMode)}
          tone={needsAccept ? 'success' : order.status === 'cancelled' ? 'error' : 'neutral'}
        />
      </View>

      <Text style={styles.customer}>Ordered by {customerLabel(snap)}</Text>

      <Text style={styles.meta}>
        {order.meal_date} · {order.delivery_window} ·{' '}
        {isDelivery ? 'Delivery' : 'Takeaway'} · {formatInr(order.total)}
      </Text>

      {snap.applyJain ? (
        <View style={styles.jainPill}>
          <Text style={styles.jainText}>Jain preparation</Text>
        </View>
      ) : (
        <Text style={styles.regularPrep}>Regular preparation (not Jain)</Text>
      )}

      {plateLines.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>In the meal</Text>
          {plateLines.map((row) => (
            <Text key={row.id} style={styles.line}>
              {row.label}
            </Text>
          ))}
        </View>
      ) : null}

      {addonLines.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Add-ons</Text>
          {addonLines.map((row) => (
            <Text key={row.id} style={styles.line}>
              {row.label}
            </Text>
          ))}
        </View>
      ) : null}

      {snap.cookingInstructions ? (
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsLabel}>Cooking instructions</Text>
          <Text style={styles.instructionsValue}>{snap.cookingInstructions}</Text>
        </View>
      ) : null}

      {isDelivery ? (
        <View style={styles.locationBox}>
          <Text style={styles.locationLabel}>Deliver to {customerLabel(snap)}</Text>
          <Text style={styles.locationValue}>
            {snap.deliveryAddress ?? 'Address not provided — ask the customer before sending.'}
          </Text>
        </View>
      ) : (
        <View style={styles.pickupBox}>
          <Text style={styles.pickupLabel}>Takeaway · {customerLabel(snap)}</Text>
          <Text style={styles.pickupValue}>
            Will pick up at your kitchen — no delivery address.
          </Text>
        </View>
      )}

      {needsAccept ? (
        <View style={styles.actions}>
          <Button
            label="Accept order"
            size="sm"
            loading={busy}
            onPress={() => void onAccept?.()}
            style={styles.actionBtn}
          />
          <Button
            label="Decline"
            size="sm"
            variant="outline"
            disabled={busy}
            onPress={() => void onReject?.()}
            style={styles.actionBtn}
          />
        </View>
      ) : nextLabel && onAdvance ? (
        <Button
          label={nextLabel}
          size="sm"
          loading={busy}
          onPress={() => void onAdvance()}
          style={styles.advanceBtn}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: { ...typography.labelMd, color: colors.onSurface, flex: 1 },
  customer: { ...typography.labelMd, color: colors.primary },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  jainPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tertiaryContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  jainText: { ...typography.labelSm, color: colors.onTertiary },
  regularPrep: { ...typography.bodySm, color: colors.onSurfaceVariant },
  section: { gap: 4 },
  sectionLabel: { ...typography.labelSm, color: colors.primary },
  line: { ...typography.bodyMd, color: colors.onSurface },
  locationBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 4,
  },
  locationLabel: { ...typography.labelSm, color: colors.primary },
  locationValue: { ...typography.bodyMd, color: colors.onSurface },
  pickupBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 4,
  },
  pickupLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  pickupValue: { ...typography.bodySm, color: colors.onSurfaceVariant },
  instructionsBox: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 4,
  },
  instructionsLabel: { ...typography.labelSm, color: colors.onSecondaryContainer },
  instructionsValue: { ...typography.bodyMd, color: colors.onSecondaryContainer, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flex: 1 },
  advanceBtn: { alignSelf: 'stretch', marginTop: spacing.xs },
});
