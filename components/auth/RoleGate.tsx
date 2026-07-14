import { Redirect } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { AccessDenied } from './AccessDenied';
import { LoadingState } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { useRoles } from '../../hooks/useRoles';
import type { AppRole } from '../../lib/auth/roles';

type Props = PropsWithChildren<{
  role: AppRole;
  deniedTitle?: string;
  deniedDescription?: string;
}>;

const DENIED_COPY: Record<Exclude<AppRole, 'customer'>, { title: string; description: string }> = {
  admin: {
    title: 'Admin access only',
    description: 'This area is for GharKaSwad operations staff. Sign in with an admin phone number.',
  },
  chef: {
    title: 'Chef dashboard only',
    description:
      'You need an approved home kitchen linked to your phone. Apply via Profile → Become a home chef.',
  },
};

/** Blocks route groups unless the signed-in user has the required role. */
export function RoleGate({ role, deniedTitle, deniedDescription, children }: Props) {
  const { status: authStatus } = useAuth();
  const { status: roleStatus, hasRole, chefAccessNeedsReconnect } = useRoles();

  if (authStatus === 'loading' || roleStatus === 'loading') {
    return <LoadingState label="Checking access…" />;
  }

  if (authStatus !== 'signedIn') {
    return <Redirect href="/(auth)/login" />;
  }

  if (!hasRole(role)) {
    const copy = role === 'customer' ? null : DENIED_COPY[role];
    const reconnectChef =
      role === 'chef' && chefAccessNeedsReconnect
        ? {
            title: 'Reconnect to verify chef access',
            description:
              'Your chef access could not be verified online, and the offline confirmation is older than 24 hours. Connect to the internet and try again.',
          }
        : null;
    return (
      <AccessDenied
        title={deniedTitle ?? reconnectChef?.title ?? copy?.title ?? 'Access restricted'}
        description={deniedDescription ?? reconnectChef?.description ?? copy?.description}
        returnHref={role === 'admin' ? '/(customer)/(tabs)/home' : '/(customer)/(tabs)/profile'}
        returnLabel={role === 'admin' ? 'Back to Discover' : 'Back to Profile'}
      />
    );
  }

  return <>{children}</>;
}
