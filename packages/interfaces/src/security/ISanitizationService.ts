/**
 * Interface for comprehensive input sanitization services
 */
export interface ISanitizationService {
  /**
   * Sanitizes HTML content to prevent XSS attacks
   * @param input - The HTML string to sanitize
   * @param options - Optional sanitization configuration
   * @returns Sanitized HTML string
   */
  sanitizeHTML(input: string, options?: SanitizeOptions): string;

  /**
   * Sanitizes SQL input to prevent SQL injection attacks
   * @param input - The SQL input to sanitize
   * @returns Sanitized SQL string
   */
  sanitizeSQL(input: string): string;

  /**
   * Sanitizes JSON input to prevent injection attacks
   * @param input - The JSON data to sanitize
   * @returns Sanitized JSON object
   */
  sanitizeJSON(input: any): any;

  /**
   * Sanitizes filename to prevent directory traversal attacks
   * @param input - The filename to sanitize
   * @returns Safe filename string
   */
  sanitizeFilename(input: string): string;

  /**
   * Sanitizes URL to prevent malicious redirects and SSRF attacks
   * @param input - The URL to sanitize
   * @returns Sanitized URL string
   */
  sanitizeURL(input: string): string;

  /**
   * Validates email format and sanitizes it
   * @param input - The email string to validate
   * @returns True if email is valid, false otherwise
   */
  validateEmail(input: string): boolean;

  /**
   * Validates phone number format
   * @param input - The phone number to validate
   * @param region - Optional region code for validation
   * @returns True if phone number is valid, false otherwise
   */
  validatePhoneNumber(input: string, region?: string): boolean;

  /**
   * Escapes regular expression special characters
   * @param input - The string to escape
   * @returns Escaped string safe for regex use
   */
  escapeRegex(input: string): string;
}

/**
 * Options for HTML sanitization
 */
export interface SanitizeOptions {
  /** Allowed HTML tags */
  allowedTags?: string[];

  /** Allowed attributes for each tag */
  allowedAttributes?: Record<string, string[]>;

  /** Allowed URL schemes */
  allowedSchemes?: string[];

  /** Whether to strip script tags completely */
  stripScripts?: boolean;

  /** Whether to strip style tags and attributes */
  stripStyles?: boolean;

  /** Maximum length of input */
  maxLength?: number;

  /** Whether to preserve whitespace */
  preserveWhitespace?: boolean;

  /** Custom attribute sanitizer functions */
  attributeSanitizers?: Record<string, AttributeSanitizer>;
}

/**
 * Function type for custom attribute sanitization
 */
export type AttributeSanitizer = (value: string, tagName: string, attributeName: string) => string;

/**
 * Configuration for URL sanitization
 */
export interface URLSanitizeOptions {
  /** Allowed protocols */
  allowedProtocols?: string[];

  /** Allowed domains (if specified, only these domains are allowed) */
  allowedDomains?: string[];

  /** Blocked domains */
  blockedDomains?: string[];

  /** Whether to allow relative URLs */
  allowRelative?: boolean;

  /** Whether to allow localhost URLs */
  allowLocalhost?: boolean;

  /** Whether to allow IP addresses */
  allowIPAddresses?: boolean;
}

/**
 * Result of sanitization operation
 */
export interface SanitizationResult {
  /** The sanitized content */
  sanitized: string | any;

  /** Whether any modifications were made */
  modified: boolean;

  /** List of modifications that were applied */
  modifications: SanitizationModification[];

  /** Warnings about potentially dangerous content */
  warnings: SanitizationWarning[];
}

/**
 * Details about a sanitization modification
 */
export interface SanitizationModification {
  /** Type of modification */
  type: 'removed' | 'escaped' | 'replaced' | 'truncated';

  /** Description of what was modified */
  description: string;

  /** Original value that was modified */
  originalValue?: string;

  /** New value after modification */
  newValue?: string;

  /** Location of modification if applicable */
  location?: string;
}

/**
 * Warning about potentially dangerous content
 */
export interface SanitizationWarning {
  /** Warning severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /** Warning message */
  message: string;

  /** Recommended action */
  recommendation?: string;

  /** Content that triggered the warning */
  triggerContent?: string;
}