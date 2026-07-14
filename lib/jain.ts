import type { ThaliComponent } from './types';

export type JainAwareComponent = Pick<
  ThaliComponent,
  'id' | 'name' | 'has_jain_variant' | 'jain_substitute'
>;

/**
 * Global Jain preference is applied at order-build time, never per-dish.
 * When enabled, each component with a jain_substitute is renamed accordingly.
 */
export function applyJainSubstitution<T extends JainAwareComponent>(
  components: T[],
  jainEnabled: boolean,
): T[] {
  if (!jainEnabled) {
    return components.map((c) => ({ ...c }));
  }

  return components.map((component) => {
    if (component.has_jain_variant && component.jain_substitute) {
      return {
        ...component,
        name: component.jain_substitute,
      };
    }
    return { ...component };
  });
}
