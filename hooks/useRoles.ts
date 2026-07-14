import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { resolveUserAccess, type AppRole, type UserAccess } from '../lib/auth/roles';

export type UseRolesResult = UserAccess & {
  status: 'loading' | 'guest' | 'ready';
  hasRole: (role: AppRole) => boolean;
  refetch: () => void;
};

export function useRoles(): UseRolesResult {
  const { user, status: authStatus } = useAuth();
  const phone = user?.phone ?? null;

  const accessQuery = useQuery({
    queryKey: ['user-access', phone],
    queryFn: () => resolveUserAccess(phone),
    enabled: authStatus === 'signedIn' && Boolean(phone),
    // Re-check remote chef status often — local map alone must not stick forever.
    staleTime: 15_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  if (authStatus === 'loading' || (authStatus === 'signedIn' && accessQuery.isLoading)) {
    return {
      roles: [],
      makerId: null,
      isAdmin: false,
      isChef: false,
      isCustomer: false,
      chefAccessNeedsReconnect: false,
      status: 'loading',
      hasRole: () => false,
      refetch: () => void accessQuery.refetch(),
    };
  }

  if (authStatus !== 'signedIn' || !phone) {
    return {
      roles: [],
      makerId: null,
      isAdmin: false,
      isChef: false,
      isCustomer: false,
      chefAccessNeedsReconnect: false,
      status: 'guest',
      hasRole: () => false,
      refetch: () => void accessQuery.refetch(),
    };
  }

  const access = accessQuery.data ?? {
    roles: ['customer'] as AppRole[],
    makerId: null,
    isAdmin: false,
    isChef: false,
    isCustomer: true,
    chefAccessNeedsReconnect: false,
  };

  return {
    ...access,
    status: 'ready',
    hasRole: (role) => access.roles.includes(role),
    refetch: () => void accessQuery.refetch(),
  };
}
