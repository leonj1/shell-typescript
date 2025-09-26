/**
 * Interface for Content Security Policy (CSP) management
 */
export interface ICSPManager {
  /**
   * Generates a CSP header string based on provided options
   * @param options - CSP configuration options
   * @returns The complete CSP header string
   */
  generatePolicy(options: CSPOptions): string;

  /**
   * Validates a CSP policy string for correctness
   * @param policy - The CSP policy string to validate
   * @returns Validation result with errors if any
   */
  validatePolicy(policy: string): CSPValidationResult;

  /**
   * Reports a CSP violation for monitoring and analysis
   * @param violation - The CSP violation report
   */
  reportViolation(violation: CSPViolation): void;

  /**
   * Updates the current CSP policy with new directives
   * @param updates - Partial CSP options to merge with current policy
   */
  updatePolicy(updates: Partial<CSPOptions>): void;

  /**
   * Generates a cryptographically secure nonce for inline scripts/styles
   * @returns A unique nonce string
   */
  getNonce(): string;
}

/**
 * Configuration options for Content Security Policy
 */
export interface CSPOptions {
  /** Default source for loading content */
  defaultSrc: string[];

  /** Allowed sources for JavaScript */
  scriptSrc: string[];

  /** Allowed sources for CSS */
  styleSrc: string[];

  /** Allowed sources for images */
  imgSrc: string[];

  /** Allowed sources for fetch, XHR, WebSocket connections */
  connectSrc: string[];

  /** Allowed sources for fonts */
  fontSrc: string[];

  /** Allowed sources for embedded objects */
  objectSrc: string[];

  /** Allowed sources for media elements */
  mediaSrc: string[];

  /** Allowed sources for frames */
  frameSrc: string[];

  /** URI to send violation reports to */
  reportUri?: string;

  /** Whether to use report-only mode (violations logged but not blocked) */
  reportOnly?: boolean;

  /** Whether to upgrade insecure requests to HTTPS */
  upgradeInsecureRequests?: boolean;
}

/**
 * Result of CSP policy validation
 */
export interface CSPValidationResult {
  /** Whether the policy is valid */
  valid: boolean;

  /** Validation errors if any */
  errors?: CSPValidationError[];

  /** Warnings about potentially insecure directives */
  warnings?: CSPWarning[];

  /** Parsed policy directives */
  parsedPolicy?: Record<string, string[]>;
}

/**
 * CSP validation error details
 */
export interface CSPValidationError {
  /** Error severity level */
  severity: 'error' | 'warning';

  /** Error message */
  message: string;

  /** Directive that caused the error */
  directive?: string;

  /** Invalid value if applicable */
  value?: string;

  /** Line number in policy if applicable */
  line?: number;
}

/**
 * CSP warning for potentially insecure configurations
 */
export interface CSPWarning {
  /** Warning message */
  message: string;

  /** Directive that triggered the warning */
  directive: string;

  /** Recommended action */
  recommendation?: string;
}

/**
 * CSP violation report structure
 */
export interface CSPViolation {
  /** The violated directive */
  violatedDirective: string;

  /** The blocked URI that caused the violation */
  blockedUri: string;

  /** The document URI where the violation occurred */
  documentUri: string;

  /** The original policy that was violated */
  originalPolicy: string;

  /** The effective directive that was violated */
  effectiveDirective: string;

  /** The source file where the violation occurred */
  sourceFile?: string;

  /** The line number where the violation occurred */
  lineNumber?: number;

  /** The column number where the violation occurred */
  columnNumber?: number;

  /** The status code of the HTTP response */
  statusCode?: number;

  /** User agent string */
  userAgent?: string;

  /** Timestamp of the violation */
  timestamp: Date;

  /** Additional violation details */
  metadata?: Record<string, any>;
}