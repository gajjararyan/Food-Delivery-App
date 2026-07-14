import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Button, Card } from '../../../components/ui';
import { legalHubHref } from '../../../constants/legal/routes';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useRoles } from '../../../hooks/useRoles';
import { fetchMakerForCurrentPhone } from '../../../lib/api/chefs';
import { roleLabel } from '../../../lib/auth/roles';

/** Stitch: Profile & Settings */
export default function ProfileTab() {
  const { status, profile, user, signOut } = useAuth();
  const { isChef, isAdmin, roles, status: roleStatus, makerId } = useRoles();
  const phone = user?.phone ?? profile?.phone;

  const makerQuery = useQuery({
    queryKey: ['profile-maker', phone, makerId],
    enabled: isChef && Boolean(phone),
    queryFn: async () => {
      const result = await fetchMakerForCurrentPhone(phone!);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>

        {status === 'signedIn' ? (
          <Card style={styles.card}>
            <Text style={styles.rowLabel}>{profile?.full_name ?? 'GharKaSwad diner'}</Text>
            {profile?.email ? <Text style={styles.meta}>{profile.email}</Text> : null}
            <Text style={styles.meta}>{profile?.phone ?? user?.phone ?? ''}</Text>
            <Text style={styles.meta}>
              Jain preference · {profile?.jain_preference ? 'On' : 'Off'}
            </Text>
            {roleStatus === 'ready' && roles[0] ? (
              <Text style={styles.roleBadge}>
                {roleLabel(roles[0])}
                {roles[0] === 'chef'
                  ? ` · ${makerQuery.data?.kitchen_name ?? 'Kitchen'}`
                  : ''}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text style={styles.rowLabel}>Browsing as guest</Text>
            <Link href="/(auth)/login">
              <Text style={styles.link}>Sign in</Text>
            </Link>
          </Card>
        )}

        {isChef ? (
          <Card style={styles.card}>
            <Text style={styles.rowLabel}>Chef dashboard</Text>
            <Link href={'/(chef)/(tabs)/' as Href}>
              <Text style={styles.link}>Manage kitchen</Text>
            </Link>
          </Card>
        ) : null}

        {isAdmin ? (
          <Card style={styles.card}>
            <Text style={styles.rowLabel}>Admin · marketplace ops</Text>
            <Link href={'/(admin)/(tabs)/' as Href}>
              <Text style={styles.link}>Open ops dashboard</Text>
            </Link>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.rowLabel}>Dietary preferences</Text>
          <Link href="/(customer)/dietary">
            <Text style={styles.link}>Manage</Text>
          </Link>
        </Card>
        <Card style={styles.card}>
          <Text style={styles.rowLabel}>Meal calendar</Text>
          <Link href="/(customer)/meal-calendar">
            <Text style={styles.link}>Open</Text>
          </Link>
        </Card>
        {!isChef ? (
          <Card style={styles.card}>
            <Text style={styles.rowLabel}>Become a home chef</Text>
            <Link href="/(customer)/become-chef">
              <Text style={styles.link}>Apply</Text>
            </Link>
          </Card>
        ) : null}
        <Card style={styles.card}>
          <Text style={styles.rowLabel}>Legal &amp; policies</Text>
          <Link href={legalHubHref}>
            <Text style={styles.link}>View</Text>
          </Link>
        </Card>

        {status === 'signedIn' ? (
          <>
            <Card style={styles.card}>
              <Text style={styles.rowLabel}>Delete account</Text>
              <Link href="/(customer)/delete-account">
                <Text style={[styles.link, styles.dangerLink]}>Request</Text>
              </Link>
            </Card>
            <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.margin,
    gap: spacing.base,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onBackground,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  rowLabel: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  meta: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    width: '100%',
  },
  roleBadge: {
    ...typography.labelSm,
    color: colors.primary,
    width: '100%',
    marginTop: 2,
  },
  link: {
    ...typography.labelMd,
    color: colors.primary,
  },
  dangerLink: {
    color: colors.error,
  },
});
