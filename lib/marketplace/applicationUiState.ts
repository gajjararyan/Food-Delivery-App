import type { ChefApplication } from '../types';

export type ApplicationUiState = 'pending' | 'accepted' | 'rejected' | 'needs_retry';

/**
 * Admin/chef-facing display state for an application.
 * `needs_retry` wins over plain `accepted` when kitchen activation failed.
 */
export function applicationUiState(application: ChefApplication): ApplicationUiState {
  if (application.activation_error) return 'needs_retry';
  if (application.status === 'accepted') return 'accepted';
  if (application.status === 'rejected') return 'rejected';
  return 'pending';
}

export function applicationStatusLabel(state: ApplicationUiState): string {
  switch (state) {
    case 'needs_retry':
      return 'Needs retry';
    case 'accepted':
      return 'accepted';
    case 'rejected':
      return 'rejected';
    case 'pending':
      return 'pending';
  }
}
