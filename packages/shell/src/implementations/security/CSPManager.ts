import { randomBytes } from 'crypto';
import {
  ICSPManager,
  CSPOptions,
  CSPValidationResult,
  CSPViolation,
  CSPValidationError,
  CSPWarning
} from '@shell/interfaces';

/**
 * Configuration for CSP Manager
 */
export interface CSPManagerConfig {
  /** Default CSP options to use as base */
  defaultOptions?: Partial<CSPOptions>;

  /** Whether to use strict-dynamic for scripts */
  useStrictDynamic?: boolean;

  /** Whether to enable violation reporting */
  enableViolationReporting?: boolean;

  /** Endpoint URL for violation reports */
  reportEndpoint?: string;

  /** Environment-specific settings */
  environment?: 'development' | 'staging' | 'production';
}

/**
 * Production-ready CSP manager with nonce generation and policy validation
 */
export class CSPManager implements ICSPManager {
  private config: CSPManagerConfig;
  private currentPolicy: CSPOptions;
  private nonceCache = new Map<string, { nonce: string; expiry: number }>();
  private violationHandlers: Array<(violation: CSPViolation) => void> = [];

  constructor(config: CSPManagerConfig = {}) {
    this.config = config;
    this.currentPolicy = this.getDefaultPolicy();

    if (config.defaultOptions) {
      this.currentPolicy = { ...this.currentPolicy, ...config.defaultOptions };
    }

    // Clean up expired nonces every hour
    setInterval(() => this.cleanupNonces(), 3600000);
  }

  /**
   * Generates a CSP header string based on provided options
   */
  generatePolicy(options: CSPOptions): string {
    const mergedOptions = { ...this.currentPolicy, ...options };
    const directives: string[] = [];

    // Build directive strings
    if (mergedOptions.defaultSrc.length > 0) {
      directives.push(`default-src ${mergedOptions.defaultSrc.join(' ')}`);
    }

    if (mergedOptions.scriptSrc.length > 0) {
      const scriptSources = [...mergedOptions.scriptSrc];

      // Add strict-dynamic if enabled
      if (this.config.useStrictDynamic) {
        scriptSources.push("'strict-dynamic'");
      }

      directives.push(`script-src ${scriptSources.join(' ')}`);
    }

    if (mergedOptions.styleSrc.length > 0) {
      directives.push(`style-src ${mergedOptions.styleSrc.join(' ')}`);
    }

    if (mergedOptions.imgSrc.length > 0) {
      directives.push(`img-src ${mergedOptions.imgSrc.join(' ')}`);
    }

    if (mergedOptions.connectSrc.length > 0) {
      directives.push(`connect-src ${mergedOptions.connectSrc.join(' ')}`);
    }

    if (mergedOptions.fontSrc.length > 0) {
      directives.push(`font-src ${mergedOptions.fontSrc.join(' ')}`);
    }

    if (mergedOptions.objectSrc.length > 0) {
      directives.push(`object-src ${mergedOptions.objectSrc.join(' ')}`);
    }

    if (mergedOptions.mediaSrc.length > 0) {
      directives.push(`media-src ${mergedOptions.mediaSrc.join(' ')}`);
    }

    if (mergedOptions.frameSrc.length > 0) {
      directives.push(`frame-src ${mergedOptions.frameSrc.join(' ')}`);
    }

    // Add upgrade-insecure-requests if enabled
    if (mergedOptions.upgradeInsecureRequests) {
      directives.push('upgrade-insecure-requests');
    }

    // Add report-uri if specified
    if (mergedOptions.reportUri) {
      directives.push(`report-uri ${mergedOptions.reportUri}`);
    }

    return directives.join('; ');
  }

  /**
   * Validates a CSP policy string for correctness
   */
  validatePolicy(policy: string): CSPValidationResult {
    const errors: CSPValidationError[] = [];
    const warnings: CSPWarning[] = [];
    const parsedPolicy: Record<string, string[]> = {};

    try {
      // Parse the policy
      const directives = policy.split(';').map(d => d.trim()).filter(d => d);

      for (const directive of directives) {
        const [name, ...values] = directive.split(/\s+/);
        const directiveName = name.toLowerCase();

        if (!this.isValidDirectiveName(directiveName)) {
          errors.push({
            severity: 'error',
            message: `Unknown directive: ${directiveName}`,
            directive: directiveName
          });
          continue;
        }

        parsedPolicy[directiveName] = values;

        // Validate directive values
        const validationResult = this.validateDirectiveValues(directiveName, values);
        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);
      }

      // Check for security best practices
      const bestPracticeWarnings = this.checkBestPractices(parsedPolicy);
      warnings.push(...bestPracticeWarnings);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        severity: 'error',
        message: `Policy parsing error: ${errorMessage}`
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      parsedPolicy: Object.keys(parsedPolicy).length > 0 ? parsedPolicy : undefined
    };
  }

  /**
   * Reports a CSP violation for monitoring and analysis
   */
  reportViolation(violation: CSPViolation): void {
    // Add timestamp if not present
    if (!violation.timestamp) {
      violation.timestamp = new Date();
    }

    // Call registered violation handlers
    for (const handler of this.violationHandlers) {
      try {
        handler(violation);
      } catch (error) {
        console.error('Error in CSP violation handler:', error);
      }
    }

    // Log violation for debugging
    if (this.config.environment === 'development') {
      console.warn('CSP Violation:', violation);
    }

    // Send to reporting endpoint if configured
    if (this.config.reportEndpoint && this.config.enableViolationReporting) {
      this.sendViolationReport(violation);
    }
  }

  /**
   * Updates the current CSP policy with new directives
   */
  updatePolicy(updates: Partial<CSPOptions>): void {
    this.currentPolicy = { ...this.currentPolicy, ...updates };
  }

  /**
   * Generates a cryptographically secure nonce for inline scripts/styles
   */
  getNonce(): string {
    const nonce = randomBytes(16).toString('base64');
    const expiry = Date.now() + 300000; // 5 minutes

    // Cache nonce for validation
    this.nonceCache.set(nonce, { nonce, expiry });

    return nonce;
  }

  /**
   * Validates if a nonce is valid and not expired
   */
  isValidNonce(nonce: string): boolean {
    const cached = this.nonceCache.get(nonce);
    if (!cached) {
      return false;
    }

    if (Date.now() > cached.expiry) {
      this.nonceCache.delete(nonce);
      return false;
    }

    return true;
  }

  /**
   * Registers a violation handler
   */
  onViolation(handler: (violation: CSPViolation) => void): () => void {
    this.violationHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.violationHandlers.indexOf(handler);
      if (index >= 0) {
        this.violationHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Gets the current policy options
   */
  getCurrentPolicy(): CSPOptions {
    return { ...this.currentPolicy };
  }

  /**
   * Creates environment-specific policy
   */
  createEnvironmentPolicy(): CSPOptions {
    const basePolicy = this.getDefaultPolicy();

    switch (this.config.environment) {
      case 'development':
        return {
          ...basePolicy,
          scriptSrc: [...basePolicy.scriptSrc, "'unsafe-eval'", "'unsafe-inline'"],
          styleSrc: [...basePolicy.styleSrc, "'unsafe-inline'"],
          connectSrc: [...basePolicy.connectSrc, 'ws:', 'wss:', 'http://localhost:*']
        };

      case 'staging':
        return {
          ...basePolicy,
          reportOnly: true,
          reportUri: this.config.reportEndpoint
        };

      case 'production':
      default:
        return {
          ...basePolicy,
          upgradeInsecureRequests: true,
          reportUri: this.config.reportEndpoint
        };
    }
  }

  /**
   * Gets default secure CSP policy
   */
  private getDefaultPolicy(): CSPOptions {
    return {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{NONCE}'"],
      styleSrc: ["'self'", "'nonce-{NONCE}'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: true
    };
  }

  /**
   * Validates directive names
   */
  private isValidDirectiveName(directive: string): boolean {
    const validDirectives = [
      'default-src', 'script-src', 'style-src', 'img-src', 'connect-src',
      'font-src', 'object-src', 'media-src', 'frame-src', 'child-src',
      'worker-src', 'manifest-src', 'navigate-to', 'form-action',
      'frame-ancestors', 'base-uri', 'report-uri', 'report-to',
      'upgrade-insecure-requests', 'block-all-mixed-content',
      'require-sri-for', 'plugin-types', 'sandbox'
    ];

    return validDirectives.includes(directive);
  }

  /**
   * Validates directive values
   */
  private validateDirectiveValues(
    directive: string,
    values: string[]
  ): { errors: CSPValidationError[]; warnings: CSPWarning[] } {
    const errors: CSPValidationError[] = [];
    const warnings: CSPWarning[] = [];

    for (const value of values) {
      // Check for unsafe values
      if (value === "'unsafe-eval'" || value === "'unsafe-inline'") {
        warnings.push({
          message: `Potentially unsafe value '${value}' in ${directive}`,
          directive,
          recommendation: `Consider using nonces or strict-dynamic instead of ${value}`
        });
      }

      // Validate nonce format
      if (value.startsWith("'nonce-") && !value.match(/^'nonce-[A-Za-z0-9+/]+=*'$/)) {
        errors.push({
          severity: 'error',
          message: `Invalid nonce format: ${value}`,
          directive,
          value
        });
      }

      // Validate hash format
      if (value.startsWith("'sha")) {
        if (!value.match(/^'sha(256|384|512)-[A-Za-z0-9+/]+=*'$/)) {
          errors.push({
            severity: 'error',
            message: `Invalid hash format: ${value}`,
            directive,
            value
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Checks CSP best practices
   */
  private checkBestPractices(policy: Record<string, string[]>): CSPWarning[] {
    const warnings: CSPWarning[] = [];

    // Check for missing object-src 'none'
    if (!policy['object-src'] || !policy['object-src'].includes("'none'")) {
      warnings.push({
        message: "Consider setting object-src to 'none' to prevent plugin-based attacks",
        directive: 'object-src',
        recommendation: "Add object-src 'none' to your policy"
      });
    }

    // Check for overly permissive default-src
    if (policy['default-src'] && policy['default-src'].includes('*')) {
      warnings.push({
        message: "Wildcard (*) in default-src allows loading from any source",
        directive: 'default-src',
        recommendation: "Specify explicit sources instead of using wildcard"
      });
    }

    // Check for missing base-uri
    if (!policy['base-uri']) {
      warnings.push({
        message: "Consider adding base-uri directive to prevent base tag injection",
        directive: 'base-uri',
        recommendation: "Add base-uri 'self' to your policy"
      });
    }

    return warnings;
  }

  /**
   * Sends violation report to configured endpoint
   */
  private async sendViolationReport(violation: CSPViolation): Promise<void> {
    if (!this.config.reportEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.config.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'csp-report': violation
        })
      });

      if (!response.ok) {
        console.error('Failed to send CSP violation report:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending CSP violation report:', error);
    }
  }

  /**
   * Cleans up expired nonces
   */
  private cleanupNonces(): void {
    const now = Date.now();

    for (const [nonce, cached] of this.nonceCache.entries()) {
      if (now > cached.expiry) {
        this.nonceCache.delete(nonce);
      }
    }
  }
}