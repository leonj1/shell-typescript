/**
 * In-memory feature flag provider for development and testing
 */

import {
  IFeatureFlagProvider,
  FeatureFlag,
  FeatureFlagChange
} from '@shell/interfaces';

export class InMemoryFeatureFlagProvider implements IFeatureFlagProvider {
  private flags: Map<string, FeatureFlag> = new Map();
  private subscribers: ((changes: FeatureFlagChange[]) => void)[] = [];

  constructor(initialFlags?: Map<string, FeatureFlag>) {
    if (initialFlags) {
      this.flags = new Map(initialFlags);
    }

    // Seed with some default flags for demonstration
    this.seedDefaultFlags();
  }

  /**
   * Seeds the provider with default feature flags
   */
  private seedDefaultFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'new-ui-design',
        enabled: true,
        description: 'Enable the new UI design',
        type: 'boolean',
        createdAt: new Date(),
        owner: 'ui-team',
        tags: ['ui', 'frontend']
      },
      {
        key: 'advanced-analytics',
        enabled: false,
        description: 'Enable advanced analytics features',
        type: 'boolean',
        createdAt: new Date(),
        owner: 'analytics-team',
        tags: ['analytics', 'feature']
      },
      {
        key: 'payment-methods',
        enabled: true,
        description: 'Available payment methods',
        type: 'multivariate',
        variants: [
          {
            key: 'credit-card',
            name: 'Credit Card Only',
            value: ['credit-card'],
            enabled: true,
            weight: 50
          },
          {
            key: 'all-methods',
            name: 'All Payment Methods',
            value: ['credit-card', 'paypal', 'apple-pay', 'google-pay'],
            enabled: true,
            weight: 50
          }
        ],
        defaultVariant: 'credit-card',
        createdAt: new Date(),
        owner: 'payments-team',
        tags: ['payments', 'checkout']
      },
      {
        key: 'beta-features',
        enabled: false,
        description: 'Enable beta features for specific users',
        type: 'boolean',
        rules: [
          {
            id: 'beta-users-rule',
            description: 'Enable for beta users',
            conditions: [
              {
                attribute: 'userRoles',
                operator: 'contains',
                value: 'beta-tester'
              }
            ],
            operator: 'AND',
            action: { type: 'enable' },
            enabled: true,
            priority: 100
          }
        ],
        createdAt: new Date(),
        owner: 'product-team',
        tags: ['beta', 'testing']
      }
    ];

    for (const flag of defaultFlags) {
      this.flags.set(flag.key, flag);
    }
  }

  /**
   * Gets all flags from the provider
   */
  async getFlags(): Promise<Map<string, FeatureFlag>> {
    return new Map(this.flags);
  }

  /**
   * Gets a specific flag from the provider
   */
  async getFlag(key: string): Promise<FeatureFlag | null> {
    return this.flags.get(key) || null;
  }

  /**
   * Updates a flag in the provider
   */
  async updateFlag(key: string, flag: FeatureFlag): Promise<void> {
    const previousFlag = this.flags.get(key);
    const isNew = !previousFlag;

    flag.key = key; // Ensure key consistency
    flag.updatedAt = new Date();

    if (isNew) {
      flag.createdAt = new Date();
    }

    this.flags.set(key, flag);

    // Notify subscribers
    const change: FeatureFlagChange = {
      key,
      type: isNew ? 'created' : 'updated',
      previousValue: previousFlag,
      newValue: flag,
      timestamp: new Date()
    };

    this.notifySubscribers([change]);
  }

  /**
   * Deletes a flag from the provider
   */
  async deleteFlag(key: string): Promise<void> {
    const previousFlag = this.flags.get(key);

    if (!previousFlag) {
      return; // Flag doesn't exist
    }

    this.flags.delete(key);

    // Notify subscribers
    const change: FeatureFlagChange = {
      key,
      type: 'deleted',
      previousValue: previousFlag,
      timestamp: new Date()
    };

    this.notifySubscribers([change]);
  }

  /**
   * Subscribes to flag changes
   */
  subscribe(callback: (changes: FeatureFlagChange[]) => void): () => void {
    this.subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notifies all subscribers of changes
   */
  private notifySubscribers(changes: FeatureFlagChange[]): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(changes);
      } catch (error) {
        console.error('Error notifying feature flag subscriber:', error);
      }
    }
  }

  /**
   * Bulk update multiple flags
   */
  async updateFlags(flags: Record<string, FeatureFlag>): Promise<void> {
    const changes: FeatureFlagChange[] = [];

    for (const [key, flag] of Object.entries(flags)) {
      const previousFlag = this.flags.get(key);
      const isNew = !previousFlag;

      flag.key = key;
      flag.updatedAt = new Date();

      if (isNew) {
        flag.createdAt = new Date();
      }

      this.flags.set(key, flag);

      changes.push({
        key,
        type: isNew ? 'created' : 'updated',
        previousValue: previousFlag,
        newValue: flag,
        timestamp: new Date()
      });
    }

    if (changes.length > 0) {
      this.notifySubscribers(changes);
    }
  }

  /**
   * Clears all flags
   */
  async clearFlags(): Promise<void> {
    const changes: FeatureFlagChange[] = [];

    for (const [key, flag] of this.flags) {
      changes.push({
        key,
        type: 'deleted',
        previousValue: flag,
        timestamp: new Date()
      });
    }

    this.flags.clear();

    if (changes.length > 0) {
      this.notifySubscribers(changes);
    }
  }

  /**
   * Gets flags by tag
   */
  async getFlagsByTag(tag: string): Promise<Map<string, FeatureFlag>> {
    const result = new Map<string, FeatureFlag>();

    for (const [key, flag] of this.flags) {
      if (flag.tags?.includes(tag)) {
        result.set(key, flag);
      }
    }

    return result;
  }

  /**
   * Gets flags by owner
   */
  async getFlagsByOwner(owner: string): Promise<Map<string, FeatureFlag>> {
    const result = new Map<string, FeatureFlag>();

    for (const [key, flag] of this.flags) {
      if (flag.owner === owner) {
        result.set(key, flag);
      }
    }

    return result;
  }

  /**
   * Gets flags that are expiring soon
   */
  async getExpiringFlags(withinDays: number = 7): Promise<Map<string, FeatureFlag>> {
    const result = new Map<string, FeatureFlag>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + withinDays);

    for (const [key, flag] of this.flags) {
      if (flag.expiresAt && flag.expiresAt <= cutoffDate) {
        result.set(key, flag);
      }
    }

    return result;
  }

  /**
   * Gets provider statistics
   */
  getStatistics(): ProviderStatistics {
    const now = new Date();
    let enabledCount = 0;
    let expiredCount = 0;
    let variantCount = 0;

    for (const flag of this.flags.values()) {
      if (flag.enabled) {
        enabledCount++;
      }

      if (flag.expiresAt && flag.expiresAt < now) {
        expiredCount++;
      }

      if (flag.variants && flag.variants.length > 0) {
        variantCount++;
      }
    }

    return {
      totalFlags: this.flags.size,
      enabledFlags: enabledCount,
      disabledFlags: this.flags.size - enabledCount,
      expiredFlags: expiredCount,
      flagsWithVariants: variantCount,
      subscriberCount: this.subscribers.length
    };
  }
}

/**
 * Provider statistics interface
 */
export interface ProviderStatistics {
  totalFlags: number;
  enabledFlags: number;
  disabledFlags: number;
  expiredFlags: number;
  flagsWithVariants: number;
  subscriberCount: number;
}