/**
 * Feature flag management interfaces and types
 * Provides feature flag evaluation with context support
 */

export interface IFeatureFlagManager {
  /**
   * Checks if a feature flag is enabled
   * @param key - Feature flag key
   * @param context - Optional evaluation context
   * @returns True if flag is enabled
   */
  isEnabled(key: string, context?: EvaluationContext): boolean;

  /**
   * Checks if a feature flag is enabled asynchronously
   * @param key - Feature flag key
   * @param context - Optional evaluation context
   * @returns Promise resolving to true if flag is enabled
   */
  isEnabledAsync(key: string, context?: EvaluationContext): Promise<boolean>;

  /**
   * Gets a feature flag variant
   * @param key - Feature flag key
   * @param context - Optional evaluation context
   * @returns Variant value or null if not found
   */
  getVariant(key: string, context?: EvaluationContext): string | null;

  /**
   * Gets a feature flag variant asynchronously
   * @param key - Feature flag key
   * @param context - Optional evaluation context
   * @returns Promise resolving to variant value or null
   */
  getVariantAsync(key: string, context?: EvaluationContext): Promise<string | null>;

  /**
   * Gets a typed feature flag value
   * @param key - Feature flag key
   * @param defaultValue - Default value if flag not found
   * @param context - Optional evaluation context
   * @returns Typed flag value
   */
  getValue<T>(key: string, defaultValue: T, context?: EvaluationContext): T;

  /**
   * Gets a typed feature flag value asynchronously
   * @param key - Feature flag key
   * @param defaultValue - Default value if flag not found
   * @param context - Optional evaluation context
   * @returns Promise resolving to typed flag value
   */
  getValueAsync<T>(key: string, defaultValue: T, context?: EvaluationContext): Promise<T>;

  /**
   * Sets a feature flag value
   * @param key - Feature flag key
   * @param enabled - Whether the flag is enabled
   * @returns Promise resolving when flag is set
   */
  setFlag(key: string, enabled: boolean): Promise<void>;

  /**
   * Sets a feature flag with full configuration
   * @param key - Feature flag key
   * @param flag - Complete feature flag definition
   * @returns Promise resolving when flag is set
   */
  setFlagConfig(key: string, flag: FeatureFlag): Promise<void>;

  /**
   * Removes a feature flag
   * @param key - Feature flag key to remove
   * @returns Promise resolving when flag is removed
   */
  removeFlag(key: string): Promise<void>;

  /**
   * Gets all feature flags
   * @returns Map of all feature flags
   */
  getAllFlags(): Promise<Map<string, FeatureFlag>>;

  /**
   * Gets flags that match a prefix
   * @param prefix - Key prefix to match
   * @returns Map of matching feature flags
   */
  getFlagsByPrefix(prefix: string): Promise<Map<string, FeatureFlag>>;

  /**
   * Loads flags from the configured provider
   * @returns Promise resolving when flags are loaded
   */
  loadFlags(): Promise<void>;

  /**
   * Refreshes flags from the provider
   * @returns Promise resolving when flags are refreshed
   */
  refreshFlags(): Promise<void>;

  /**
   * Adds an event listener for flag changes
   * @param event - Event name
   * @param listener - Event listener function
   */
  on(event: keyof FeatureFlagEvents, listener: (...args: any[]) => void): void;

  /**
   * Removes an event listener
   * @param event - Event name
   * @param listener - Event listener function to remove
   */
  off(event: keyof FeatureFlagEvents, listener: (...args: any[]) => void): void;

  /**
   * Gets flag evaluation statistics
   * @returns Statistics about flag evaluations
   */
  getStatistics(): FeatureFlagStatistics;

  /**
   * Clears flag evaluation statistics
   */
  clearStatistics(): void;
}

/**
 * Feature flag definition
 */
export interface FeatureFlag {
  /**
   * Unique flag key/identifier
   */
  key: string;

  /**
   * Whether the flag is globally enabled
   */
  enabled: boolean;

  /**
   * Flag description for documentation
   */
  description?: string;

  /**
   * Flag type for categorization
   */
  type?: FeatureFlagType;

  /**
   * Evaluation rules for conditional enabling
   */
  rules?: EvaluationRule[];

  /**
   * Available variants for A/B testing
   */
  variants?: FeatureFlagVariant[];

  /**
   * Default variant to use when enabled
   */
  defaultVariant?: string;

  /**
   * Flag metadata
   */
  metadata?: FeatureFlagMetadata;

  /**
   * Flag creation timestamp
   */
  createdAt?: Date;

  /**
   * Flag last updated timestamp
   */
  updatedAt?: Date;

  /**
   * Flag expiration timestamp
   */
  expiresAt?: Date;

  /**
   * Flag owner/creator
   */
  owner?: string;

  /**
   * Tags for organization
   */
  tags?: string[];
}

/**
 * Feature flag types
 */
export type FeatureFlagType =
  | 'boolean'
  | 'string'
  | 'number'
  | 'json'
  | 'multivariate'
  | 'experiment';

/**
 * Evaluation context for flag evaluation
 */
export interface EvaluationContext {
  /**
   * User identifier
   */
  userId?: string;

  /**
   * User email
   */
  userEmail?: string;

  /**
   * User roles
   */
  userRoles?: string[];

  /**
   * User groups
   */
  userGroups?: string[];

  /**
   * Environment (development, staging, production)
   */
  environment?: string;

  /**
   * Application version
   */
  version?: string;

  /**
   * Device type
   */
  deviceType?: string;

  /**
   * Geographic region
   */
  region?: string;

  /**
   * Request IP address
   */
  ipAddress?: string;

  /**
   * User agent string
   */
  userAgent?: string;

  /**
   * Session identifier
   */
  sessionId?: string;

  /**
   * Request identifier
   */
  requestId?: string;

  /**
   * Additional custom attributes
   */
  customAttributes?: Record<string, any>;
}

/**
 * Evaluation rule for conditional flag enabling
 */
export interface EvaluationRule {
  /**
   * Rule identifier
   */
  id: string;

  /**
   * Rule description
   */
  description?: string;

  /**
   * Rule conditions
   */
  conditions: EvaluationCondition[];

  /**
   * Whether all conditions must match (AND) or any (OR)
   */
  operator: 'AND' | 'OR';

  /**
   * Action to take if rule matches
   */
  action: EvaluationAction;

  /**
   * Rule priority (higher number = higher priority)
   */
  priority?: number;

  /**
   * Whether the rule is enabled
   */
  enabled: boolean;
}

/**
 * Evaluation condition within a rule
 */
export interface EvaluationCondition {
  /**
   * Context attribute to evaluate
   */
  attribute: string;

  /**
   * Comparison operator
   */
  operator: EvaluationOperator;

  /**
   * Value(s) to compare against
   */
  value: any;

  /**
   * Value type for proper comparison
   */
  valueType?: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

/**
 * Evaluation operators
 */
export type EvaluationOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'regex_match'
  | 'exists'
  | 'not_exists'
  | 'percentage';

/**
 * Evaluation action to take when rule matches
 */
export interface EvaluationAction {
  /**
   * Action type
   */
  type: 'enable' | 'disable' | 'variant' | 'percentage';

  /**
   * Variant to select (for variant action)
   */
  variant?: string;

  /**
   * Percentage threshold (for percentage action)
   */
  percentage?: number;
}

/**
 * Feature flag variant for A/B testing
 */
export interface FeatureFlagVariant {
  /**
   * Variant key/name
   */
  key: string;

  /**
   * Variant display name
   */
  name?: string;

  /**
   * Variant value
   */
  value: any;

  /**
   * Variant description
   */
  description?: string;

  /**
   * Traffic allocation percentage
   */
  weight?: number;

  /**
   * Whether variant is enabled
   */
  enabled: boolean;
}

/**
 * Feature flag metadata
 */
export interface FeatureFlagMetadata {
  /**
   * Related feature/component
   */
  feature?: string;

  /**
   * Jira ticket or tracking ID
   */
  ticketId?: string;

  /**
   * Documentation link
   */
  documentationUrl?: string;

  /**
   * Slack channel for discussions
   */
  slackChannel?: string;

  /**
   * Rollout percentage
   */
  rolloutPercentage?: number;

  /**
   * Kill switch flag
   */
  isKillSwitch?: boolean;

  /**
   * Temporary flag with removal date
   */
  isTemporary?: boolean;

  /**
   * Planned removal date
   */
  removalDate?: Date;
}

/**
 * Feature flag provider interface
 */
export interface IFeatureFlagProvider {
  /**
   * Gets all flags from the provider
   * @returns Promise resolving to map of flags
   */
  getFlags(): Promise<Map<string, FeatureFlag>>;

  /**
   * Gets a specific flag from the provider
   * @param key - Flag key
   * @returns Promise resolving to flag or null
   */
  getFlag(key: string): Promise<FeatureFlag | null>;

  /**
   * Updates a flag in the provider
   * @param key - Flag key
   * @param flag - Flag configuration
   * @returns Promise resolving when updated
   */
  updateFlag(key: string, flag: FeatureFlag): Promise<void>;

  /**
   * Deletes a flag from the provider
   * @param key - Flag key
   * @returns Promise resolving when deleted
   */
  deleteFlag(key: string): Promise<void>;

  /**
   * Subscribes to flag changes
   * @param callback - Callback function for changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (changes: FeatureFlagChange[]) => void): () => void;
}

/**
 * Feature flag change event
 */
export interface FeatureFlagChange {
  /**
   * Flag key that changed
   */
  key: string;

  /**
   * Type of change
   */
  type: 'created' | 'updated' | 'deleted';

  /**
   * Previous flag value
   */
  previousValue?: FeatureFlag;

  /**
   * New flag value
   */
  newValue?: FeatureFlag;

  /**
   * Change timestamp
   */
  timestamp: Date;
}

/**
 * Feature flag evaluation statistics
 */
export interface FeatureFlagStatistics {
  /**
   * Total number of evaluations
   */
  totalEvaluations: number;

  /**
   * Number of enabled evaluations
   */
  enabledEvaluations: number;

  /**
   * Number of disabled evaluations
   */
  disabledEvaluations: number;

  /**
   * Evaluation counts per flag
   */
  flagEvaluations: Map<string, number>;

  /**
   * Variant selection counts
   */
  variantSelections: Map<string, Map<string, number>>;

  /**
   * Error counts
   */
  errorCounts: Map<string, number>;

  /**
   * Statistics collection start time
   */
  collectionStartTime: Date;

  /**
   * Last evaluation timestamp
   */
  lastEvaluationTime?: Date;
}

/**
 * Feature flag events
 */
export interface FeatureFlagEvents {
  'flag:loaded': { flags: Map<string, FeatureFlag> };
  'flag:evaluated': { key: string; result: boolean; context?: EvaluationContext };
  'flag:changed': { key: string; change: FeatureFlagChange };
  'flag:error': { key: string; error: Error; context?: EvaluationContext };
  'provider:connected': { provider: string };
  'provider:disconnected': { provider: string; error?: Error };
  'provider:error': { provider: string; error: Error };
}

/**
 * Feature flag configuration
 */
export interface FeatureFlagManagerConfig {
  /**
   * Feature flag provider
   */
  provider: IFeatureFlagProvider;

  /**
   * Cache flags locally
   */
  enableCaching?: boolean;

  /**
   * Cache TTL in milliseconds
   */
  cacheTTL?: number;

  /**
   * Enable evaluation statistics
   */
  enableStatistics?: boolean;

  /**
   * Default context for evaluations
   */
  defaultContext?: Partial<EvaluationContext>;

  /**
   * Error handling strategy
   */
  errorHandling?: 'throw' | 'log' | 'silent';

  /**
   * Refresh interval for flags (in milliseconds)
   */
  refreshInterval?: number;
}