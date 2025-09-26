/**
 * Feature flag manager implementation with evaluation rules and context support
 */

import { EventEmitter } from 'events';
import {
  IFeatureFlagManager,
  IFeatureFlagProvider,
  FeatureFlag,
  EvaluationContext,
  EvaluationRule,
  EvaluationCondition,
  EvaluationOperator,
  FeatureFlagStatistics,
  FeatureFlagEvents,
  FeatureFlagManagerConfig,
  FeatureFlagChange
} from '@shell/interfaces';

export class FeatureFlagManager extends EventEmitter implements IFeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private statistics: FeatureFlagStatistics;
  private config: FeatureFlagManagerConfig;
  private refreshTimer?: NodeJS.Timeout;
  private evaluator: FlagEvaluator;

  constructor(config: FeatureFlagManagerConfig) {
    super();
    this.config = config;
    this.statistics = this.initializeStatistics();
    this.evaluator = new FlagEvaluator();

    this.setupRefreshInterval();
    this.setupProviderEventListeners();
  }

  /**
   * Initializes statistics tracking
   */
  private initializeStatistics(): FeatureFlagStatistics {
    return {
      totalEvaluations: 0,
      enabledEvaluations: 0,
      disabledEvaluations: 0,
      flagEvaluations: new Map(),
      variantSelections: new Map(),
      errorCounts: new Map(),
      collectionStartTime: new Date()
    };
  }

  /**
   * Sets up automatic flag refresh if configured
   */
  private setupRefreshInterval(): void {
    if (this.config.refreshInterval && this.config.refreshInterval > 0) {
      this.refreshTimer = setInterval(async () => {
        try {
          await this.refreshFlags();
        } catch (error) {
          this.emit('provider:error', {
            provider: 'refresh-timer',
            error: error as Error
          });
        }
      }, this.config.refreshInterval);
    }
  }

  /**
   * Sets up event listeners for provider changes
   */
  private setupProviderEventListeners(): void {
    if (typeof this.config.provider.subscribe === 'function') {
      this.config.provider.subscribe((changes: FeatureFlagChange[]) => {
        this.handleProviderChanges(changes);
      });
    }
  }

  /**
   * Handles changes from the provider
   */
  private handleProviderChanges(changes: FeatureFlagChange[]): void {
    for (const change of changes) {
      switch (change.type) {
        case 'created':
        case 'updated':
          if (change.newValue) {
            this.flags.set(change.key, change.newValue);
            this.clearCache(change.key);
          }
          break;
        case 'deleted':
          this.flags.delete(change.key);
          this.clearCache(change.key);
          break;
      }

      this.emit('flag:changed', { key: change.key, change });
    }
  }

  /**
   * Checks if a feature flag is enabled
   */
  isEnabled(key: string, context?: EvaluationContext): boolean {
    try {
      const result = this.evaluateFlag(key, context);
      this.updateStatistics(key, result);

      this.emit('flag:evaluated', { key, result, context });
      return result;
    } catch (error) {
      this.handleEvaluationError(key, error as Error, context);
      return false;
    }
  }

  /**
   * Checks if a feature flag is enabled asynchronously
   */
  async isEnabledAsync(key: string, context?: EvaluationContext): Promise<boolean> {
    try {
      // Check cache first if caching is enabled
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(key, context);
        if (cached !== null) {
          this.updateStatistics(key, cached);
          return cached;
        }
      }

      // Evaluate flag
      const result = this.evaluateFlag(key, context);

      // Cache result if caching is enabled
      if (this.config.enableCaching) {
        this.cacheResult(key, context, result);
      }

      this.updateStatistics(key, result);
      this.emit('flag:evaluated', { key, result, context });
      return result;
    } catch (error) {
      this.handleEvaluationError(key, error as Error, context);
      return false;
    }
  }

  /**
   * Gets a feature flag variant
   */
  getVariant(key: string, context?: EvaluationContext): string | null {
    try {
      const flag = this.flags.get(key);
      if (!flag || !flag.enabled) {
        return null;
      }

      const variant = this.evaluator.selectVariant(flag, context);
      this.updateVariantStatistics(key, variant);
      return variant;
    } catch (error) {
      this.handleEvaluationError(key, error as Error, context);
      return null;
    }
  }

  /**
   * Gets a feature flag variant asynchronously
   */
  async getVariantAsync(key: string, context?: EvaluationContext): Promise<string | null> {
    return this.getVariant(key, context);
  }

  /**
   * Gets a typed feature flag value
   */
  getValue<T>(key: string, defaultValue: T, context?: EvaluationContext): T {
    try {
      const flag = this.flags.get(key);
      if (!flag) {
        return defaultValue;
      }

      if (!this.evaluateFlag(key, context)) {
        return defaultValue;
      }

      const variant = this.getVariant(key, context);
      if (variant) {
        const variantConfig = flag.variants?.find(v => v.key === variant);
        if (variantConfig) {
          return this.convertValue(variantConfig.value, defaultValue);
        }
      }

      // If no variant, return the default value of the flag type
      return this.convertValue(flag.enabled, defaultValue);
    } catch (error) {
      this.handleEvaluationError(key, error as Error, context);
      return defaultValue;
    }
  }

  /**
   * Gets a typed feature flag value asynchronously
   */
  async getValueAsync<T>(key: string, defaultValue: T, context?: EvaluationContext): Promise<T> {
    return this.getValue(key, defaultValue, context);
  }

  /**
   * Sets a feature flag value
   */
  async setFlag(key: string, enabled: boolean): Promise<void> {
    const existingFlag = this.flags.get(key);
    const flag: FeatureFlag = existingFlag || {
      key,
      enabled,
      description: `Flag ${key}`,
      createdAt: new Date()
    };

    flag.enabled = enabled;
    flag.updatedAt = new Date();

    await this.config.provider.updateFlag(key, flag);
    this.flags.set(key, flag);
    this.clearCache(key);
  }

  /**
   * Sets a feature flag with full configuration
   */
  async setFlagConfig(key: string, flag: FeatureFlag): Promise<void> {
    flag.updatedAt = new Date();
    if (!flag.createdAt) {
      flag.createdAt = new Date();
    }

    await this.config.provider.updateFlag(key, flag);
    this.flags.set(key, flag);
    this.clearCache(key);
  }

  /**
   * Removes a feature flag
   */
  async removeFlag(key: string): Promise<void> {
    await this.config.provider.deleteFlag(key);
    this.flags.delete(key);
    this.clearCache(key);
  }

  /**
   * Gets all feature flags
   */
  async getAllFlags(): Promise<Map<string, FeatureFlag>> {
    return new Map(this.flags);
  }

  /**
   * Gets flags that match a prefix
   */
  async getFlagsByPrefix(prefix: string): Promise<Map<string, FeatureFlag>> {
    const matchingFlags = new Map<string, FeatureFlag>();

    for (const [key, flag] of this.flags) {
      if (key.startsWith(prefix)) {
        matchingFlags.set(key, flag);
      }
    }

    return matchingFlags;
  }

  /**
   * Loads flags from the configured provider
   */
  async loadFlags(): Promise<void> {
    try {
      const flags = await this.config.provider.getFlags();
      this.flags = flags;
      this.cache.clear();
      this.emit('flag:loaded', { flags });
    } catch (error) {
      this.emit('provider:error', {
        provider: 'load-flags',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Refreshes flags from the provider
   */
  async refreshFlags(): Promise<void> {
    await this.loadFlags();
  }

  /**
   * Gets flag evaluation statistics
   */
  getStatistics(): FeatureFlagStatistics {
    return {
      ...this.statistics,
      lastEvaluationTime: this.statistics.lastEvaluationTime
    };
  }

  /**
   * Clears flag evaluation statistics
   */
  clearStatistics(): void {
    this.statistics = this.initializeStatistics();
  }

  /**
   * Evaluates a feature flag with rules and context
   */
  private evaluateFlag(key: string, context?: EvaluationContext): boolean {
    const flag = this.flags.get(key);
    if (!flag) {
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check expiration
    if (flag.expiresAt && new Date() > flag.expiresAt) {
      return false;
    }

    // If no rules, flag is enabled
    if (!flag.rules || flag.rules.length === 0) {
      return true;
    }

    // Merge default context with provided context
    const evaluationContext = {
      ...this.config.defaultContext,
      ...context
    };

    // Evaluate rules
    return this.evaluator.evaluateRules(flag.rules, evaluationContext);
  }

  /**
   * Updates statistics for flag evaluation
   */
  private updateStatistics(key: string, result: boolean): void {
    if (!this.config.enableStatistics) {
      return;
    }

    this.statistics.totalEvaluations++;
    if (result) {
      this.statistics.enabledEvaluations++;
    } else {
      this.statistics.disabledEvaluations++;
    }

    const currentCount = this.statistics.flagEvaluations.get(key) || 0;
    this.statistics.flagEvaluations.set(key, currentCount + 1);

    this.statistics.lastEvaluationTime = new Date();
  }

  /**
   * Updates statistics for variant selection
   */
  private updateVariantStatistics(key: string, variant: string | null): void {
    if (!this.config.enableStatistics || !variant) {
      return;
    }

    if (!this.statistics.variantSelections.has(key)) {
      this.statistics.variantSelections.set(key, new Map());
    }

    const variantMap = this.statistics.variantSelections.get(key)!;
    const currentCount = variantMap.get(variant) || 0;
    variantMap.set(variant, currentCount + 1);
  }

  /**
   * Handles evaluation errors
   */
  private handleEvaluationError(key: string, error: Error, context?: EvaluationContext): void {
    const currentCount = this.statistics.errorCounts.get(key) || 0;
    this.statistics.errorCounts.set(key, currentCount + 1);

    this.emit('flag:error', { key, error, context });

    if (this.config.errorHandling === 'throw') {
      throw error;
    } else if (this.config.errorHandling === 'log') {
      console.error(`Feature flag evaluation error for '${key}':`, error);
    }
    // 'silent' mode does nothing additional
  }

  /**
   * Converts a value to the expected type
   */
  private convertValue<T>(value: any, defaultValue: T): T {
    const targetType = typeof defaultValue;

    try {
      switch (targetType) {
        case 'boolean':
          return (Boolean(value)) as T;
        case 'number':
          return (Number(value)) as T;
        case 'string':
          return (String(value)) as T;
        default:
          return value as T;
      }
    } catch {
      return defaultValue;
    }
  }

  /**
   * Gets cached result if available and valid
   */
  private getCachedResult(key: string, context?: EvaluationContext): boolean | null {
    const cacheKey = this.generateCacheKey(key, context);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const now = Date.now();
    if (cached.expiresAt && now > cached.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Caches evaluation result
   */
  private cacheResult(key: string, context: EvaluationContext | undefined, result: boolean): void {
    const cacheKey = this.generateCacheKey(key, context);
    const ttl = this.config.cacheTTL || 300000; // 5 minutes default

    this.cache.set(cacheKey, {
      result,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  /**
   * Generates cache key for flag evaluation
   */
  private generateCacheKey(key: string, context?: EvaluationContext): string {
    if (!context) {
      return key;
    }

    // Create a deterministic key from context
    const contextHash = JSON.stringify(context, Object.keys(context).sort());
    return `${key}:${this.simpleHash(contextHash)}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Clears cache entries for a specific flag
   */
  private clearCache(key: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(cacheKey =>
      cacheKey === key || cacheKey.startsWith(`${key}:`)
    );

    for (const keyToDelete of keysToDelete) {
      this.cache.delete(keyToDelete);
    }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.removeAllListeners();
    this.cache.clear();
  }
}

/**
 * Cache entry for flag evaluations
 */
interface CacheEntry {
  result: boolean;
  createdAt: number;
  expiresAt: number;
}

/**
 * Flag evaluation engine
 */
class FlagEvaluator {
  /**
   * Evaluates a list of rules against context
   */
  evaluateRules(rules: EvaluationRule[], context: EvaluationContext): boolean {
    // Sort rules by priority (higher priority first)
    const sortedRules = rules
      .filter(rule => rule.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sortedRules) {
      if (this.evaluateRule(rule, context)) {
        return rule.action.type === 'enable';
      }
    }

    // No rules matched, return false (disabled)
    return false;
  }

  /**
   * Evaluates a single rule
   */
  private evaluateRule(rule: EvaluationRule, context: EvaluationContext): boolean {
    if (rule.conditions.length === 0) {
      return true;
    }

    const conditionResults = rule.conditions.map(condition =>
      this.evaluateCondition(condition, context)
    );

    return rule.operator === 'AND'
      ? conditionResults.every(result => result)
      : conditionResults.some(result => result);
  }

  /**
   * Evaluates a single condition
   */
  private evaluateCondition(condition: EvaluationCondition, context: EvaluationContext): boolean {
    const contextValue = this.getContextValue(condition.attribute, context);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return contextValue === conditionValue;
      case 'not_equals':
        return contextValue !== conditionValue;
      case 'contains':
        return String(contextValue).includes(String(conditionValue));
      case 'not_contains':
        return !String(contextValue).includes(String(conditionValue));
      case 'starts_with':
        return String(contextValue).startsWith(String(conditionValue));
      case 'ends_with':
        return String(contextValue).endsWith(String(conditionValue));
      case 'greater_than':
        return Number(contextValue) > Number(conditionValue);
      case 'greater_than_or_equal':
        return Number(contextValue) >= Number(conditionValue);
      case 'less_than':
        return Number(contextValue) < Number(conditionValue);
      case 'less_than_or_equal':
        return Number(contextValue) <= Number(conditionValue);
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(contextValue);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(contextValue);
      case 'regex_match':
        try {
          const regex = new RegExp(String(conditionValue));
          return regex.test(String(contextValue));
        } catch {
          return false;
        }
      case 'exists':
        return contextValue !== undefined && contextValue !== null;
      case 'not_exists':
        return contextValue === undefined || contextValue === null;
      case 'percentage':
        return this.evaluatePercentage(contextValue, Number(conditionValue));
      default:
        return false;
    }
  }

  /**
   * Gets a value from context using dot notation
   */
  private getContextValue(path: string, context: EvaluationContext): any {
    const keys = path.split('.');
    let value: any = context;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluates percentage-based condition
   */
  private evaluatePercentage(contextValue: any, percentage: number): boolean {
    // Use user ID or session ID for consistent percentage evaluation
    const identifier = String(contextValue);
    const hash = this.simpleHash(identifier);
    const bucketValue = parseInt(hash.slice(-4), 16) % 100;
    return bucketValue < percentage;
  }

  /**
   * Selects a variant based on flag configuration
   */
  selectVariant(flag: FeatureFlag, context?: EvaluationContext): string | null {
    if (!flag.variants || flag.variants.length === 0) {
      return flag.defaultVariant || null;
    }

    const enabledVariants = flag.variants.filter(v => v.enabled);
    if (enabledVariants.length === 0) {
      return flag.defaultVariant || null;
    }

    // If only one variant is enabled, return it
    if (enabledVariants.length === 1) {
      return enabledVariants[0].key;
    }

    // Use weighted selection if weights are defined
    const hasWeights = enabledVariants.some(v => v.weight !== undefined);
    if (hasWeights) {
      return this.selectWeightedVariant(enabledVariants, context);
    }

    // Equal distribution among variants
    return this.selectEqualDistributionVariant(enabledVariants, context);
  }

  /**
   * Selects variant using weighted distribution
   */
  private selectWeightedVariant(variants: any[], context?: EvaluationContext): string {
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    if (totalWeight === 0) {
      return variants[0].key;
    }

    // Use user ID for consistent assignment
    const identifier = context?.userId || context?.sessionId || Math.random().toString();
    const hash = this.simpleHash(identifier);
    const bucket = (parseInt(hash.slice(-8), 16) % 100) / 100;
    const targetWeight = bucket * totalWeight;

    let currentWeight = 0;
    for (const variant of variants) {
      currentWeight += variant.weight || 0;
      if (currentWeight >= targetWeight) {
        return variant.key;
      }
    }

    return variants[variants.length - 1].key;
  }

  /**
   * Selects variant using equal distribution
   */
  private selectEqualDistributionVariant(variants: any[], context?: EvaluationContext): string {
    const identifier = context?.userId || context?.sessionId || Math.random().toString();
    const hash = this.simpleHash(identifier);
    const index = parseInt(hash.slice(-4), 16) % variants.length;
    return variants[index].key;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}