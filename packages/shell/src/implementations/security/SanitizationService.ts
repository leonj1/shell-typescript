import DOMPurify from 'dompurify';
import validator from 'validator';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import {
  ISanitizationService,
  SanitizeOptions,
  URLSanitizeOptions,
  SanitizationResult,
  SanitizationModification,
  SanitizationWarning,
  AttributeSanitizer
} from '@shell/interfaces';

/**
 * Configuration for sanitization service
 */
export interface SanitizationServiceConfig {
  /** Default HTML sanitization options */
  defaultHTMLOptions?: SanitizeOptions;

  /** Default URL sanitization options */
  defaultURLOptions?: URLSanitizeOptions;

  /** Maximum input length to prevent DoS attacks */
  maxInputLength?: number;

  /** Whether to log sanitization events */
  enableLogging?: boolean;

  /** Custom sanitization rules */
  customRules?: Record<string, (input: any) => any>;
}

/**
 * Production-ready input sanitization service with comprehensive protection
 */
export class SanitizationService implements ISanitizationService {
  private config: SanitizationServiceConfig;
  private sanitizationStats = new Map<string, number>();

  constructor(config: SanitizationServiceConfig = {}) {
    this.config = {
      maxInputLength: 1000000, // 1MB default limit
      enableLogging: false,
      ...config
    };

    // Configure DOMPurify
    this.configureDOMPurify();
  }

  /**
   * Sanitizes HTML content to prevent XSS attacks
   */
  sanitizeHTML(input: string, options?: SanitizeOptions): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Check input length
    if (input.length > this.config.maxInputLength!) {
      throw new Error(`Input length exceeds maximum allowed (${this.config.maxInputLength})`);
    }

    const mergedOptions = { ...this.config.defaultHTMLOptions, ...options };

    // Configure DOMPurify options
    const purifyConfig: any = {};

    if (mergedOptions.allowedTags) {
      purifyConfig.ALLOWED_TAGS = mergedOptions.allowedTags;
    }

    if (mergedOptions.allowedAttributes) {
      purifyConfig.ALLOWED_ATTR = Object.values(mergedOptions.allowedAttributes).flat();
    }

    if (mergedOptions.allowedSchemes) {
      purifyConfig.ALLOWED_URI_REGEXP = new RegExp(
        `^(?:(?:${mergedOptions.allowedSchemes.join('|')}):)`,
        'i'
      );
    }

    if (mergedOptions.stripScripts !== false) {
      purifyConfig.FORBID_TAGS = ['script', 'object', 'embed', 'applet'];
    }

    if (mergedOptions.stripStyles !== false) {
      purifyConfig.FORBID_ATTR = ['style', 'onload', 'onerror'];
    }

    // Apply max length if specified
    let processedInput = input;
    if (mergedOptions.maxLength && input.length > mergedOptions.maxLength) {
      processedInput = input.substring(0, mergedOptions.maxLength);
    }

    // Sanitize with DOMPurify
    const sanitized = DOMPurify.sanitize(processedInput, purifyConfig);

    // Convert TrustedHTML to string if needed
    const sanitizedString = typeof sanitized === 'string' ? sanitized : String(sanitized);

    // Log sanitization if enabled
    if (this.config.enableLogging) {
      this.logSanitization('html', input.length, sanitizedString.length);
    }

    return sanitizedString;
  }

  /**
   * Sanitizes SQL input to prevent SQL injection attacks
   */
  sanitizeSQL(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Check input length
    if (input.length > this.config.maxInputLength!) {
      throw new Error(`Input length exceeds maximum allowed (${this.config.maxInputLength})`);
    }

    // Remove common SQL injection patterns
    let sanitized = input
      // Remove SQL comments
      .replace(/--[\s\S]*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove dangerous SQL keywords at word boundaries
      .replace(/\b(DROP|DELETE|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE|INSERT|UPDATE|UNION|SELECT)\b/gi, '')
      // Remove dangerous characters and sequences
      .replace(/[';\\x00\\n\\r\\x1a"]/g, '')
      // Remove potential hex encoding
      .replace(/\\x[0-9a-fA-F]{2}/g, '')
      // Remove potential unicode encoding
      .replace(/\\u[0-9a-fA-F]{4}/g, '');

    // Escape remaining single quotes
    sanitized = sanitized.replace(/'/g, "''");

    // Log sanitization if enabled
    if (this.config.enableLogging) {
      this.logSanitization('sql', input.length, sanitized.length);
    }

    return sanitized;
  }

  /**
   * Sanitizes JSON input to prevent injection attacks
   */
  sanitizeJSON(input: any): any {
    if (input === null || input === undefined) {
      return input;
    }

    // Convert to string for size check
    const inputStr = JSON.stringify(input);
    if (inputStr.length > this.config.maxInputLength!) {
      throw new Error(`Input length exceeds maximum allowed (${this.config.maxInputLength})`);
    }

    return this.deepSanitizeObject(input);
  }

  /**
   * Sanitizes filename to prevent directory traversal attacks
   */
  sanitizeFilename(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input
      // Remove path traversal sequences
      .replace(/\.\./g, '')
      .replace(/[\/\\:*?"<>|]/g, '')
      // Remove null bytes
      .replace(/\x00/g, '')
      // Remove leading/trailing dots and spaces
      .replace(/^[\s.]+|[\s.]+$/g, '')
      // Limit length
      .substring(0, 255);

    // Ensure filename is not empty after sanitization
    if (!sanitized) {
      sanitized = 'file';
    }

    // Prevent reserved names on Windows
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    if (reservedNames.includes(sanitized.toUpperCase())) {
      sanitized = `file_${sanitized}`;
    }

    return sanitized;
  }

  /**
   * Sanitizes URL to prevent malicious redirects and SSRF attacks
   */
  sanitizeURL(input: string, options?: URLSanitizeOptions): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    const mergedOptions = { ...this.config.defaultURLOptions, ...options };

    try {
      // Parse URL
      const url = new URL(input);

      // Check allowed protocols
      if (mergedOptions.allowedProtocols &&
          !mergedOptions.allowedProtocols.includes(url.protocol.slice(0, -1))) {
        throw new Error(`Protocol ${url.protocol} not allowed`);
      }

      // Check blocked domains
      if (mergedOptions.blockedDomains &&
          mergedOptions.blockedDomains.some(domain => url.hostname.includes(domain))) {
        throw new Error(`Domain ${url.hostname} is blocked`);
      }

      // Check allowed domains (if specified)
      if (mergedOptions.allowedDomains &&
          !mergedOptions.allowedDomains.some(domain => url.hostname.includes(domain))) {
        throw new Error(`Domain ${url.hostname} not in allowed list`);
      }

      // Check localhost restriction
      if (!mergedOptions.allowLocalhost &&
          (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
        throw new Error('Localhost URLs not allowed');
      }

      // Check IP address restriction
      if (!mergedOptions.allowIPAddresses && this.isIPAddress(url.hostname)) {
        throw new Error('IP addresses not allowed');
      }

      return url.toString();
    } catch (error) {
      // If relative URLs are allowed, return as-is if it's relative
      if (mergedOptions.allowRelative && !input.includes('://')) {
        return this.sanitizeRelativeURL(input);
      }

      return '';
    }
  }

  /**
   * Validates email format and sanitizes it
   */
  validateEmail(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    // Check length
    if (input.length > 254) {
      return false;
    }

    return validator.isEmail(input, {
      allow_utf8_local_part: false,
      require_tld: true,
      allow_ip_domain: false
    });
  }

  /**
   * Validates phone number format
   */
  validatePhoneNumber(input: string, region?: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    try {
      if (region) {
        return isValidPhoneNumber(input, region as any);
      } else {
        const phoneNumber = parsePhoneNumber(input);
        return phoneNumber ? phoneNumber.isValid() : false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Escapes regular expression special characters
   */
  escapeRegex(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Advanced sanitization with detailed result
   */
  sanitizeWithResult(input: any, type: 'html' | 'sql' | 'json' | 'filename' | 'url'): SanitizationResult {
    const originalInput = typeof input === 'string' ? input : JSON.stringify(input);
    const modifications: SanitizationModification[] = [];
    const warnings: SanitizationWarning[] = [];

    let sanitized: any;

    switch (type) {
      case 'html':
        sanitized = this.sanitizeHTML(input);
        break;
      case 'sql':
        sanitized = this.sanitizeSQL(input);
        break;
      case 'json':
        sanitized = this.sanitizeJSON(input);
        break;
      case 'filename':
        sanitized = this.sanitizeFilename(input);
        break;
      case 'url':
        sanitized = this.sanitizeURL(input);
        break;
      default:
        sanitized = input;
    }

    const modified = originalInput !== (typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized));

    if (modified) {
      modifications.push({
        type: 'replaced',
        description: `${type} sanitization applied`,
        originalValue: originalInput,
        newValue: typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized)
      });
    }

    return {
      sanitized,
      modified,
      modifications,
      warnings
    };
  }

  /**
   * Bulk sanitization for arrays of data
   */
  sanitizeBulk(
    inputs: any[],
    type: 'html' | 'sql' | 'json' | 'filename' | 'url'
  ): any[] {
    return inputs.map(input => {
      switch (type) {
        case 'html':
          return this.sanitizeHTML(input);
        case 'sql':
          return this.sanitizeSQL(input);
        case 'json':
          return this.sanitizeJSON(input);
        case 'filename':
          return this.sanitizeFilename(input);
        case 'url':
          return this.sanitizeURL(input);
        default:
          return input;
      }
    });
  }

  /**
   * Gets sanitization statistics
   */
  getStats(): Record<string, number> {
    return Object.fromEntries(this.sanitizationStats);
  }

  /**
   * Resets sanitization statistics
   */
  resetStats(): void {
    this.sanitizationStats.clear();
  }

  /**
   * Configures DOMPurify with secure defaults
   */
  private configureDOMPurify(): void {
    // Add custom hooks for additional security
    DOMPurify.addHook('beforeSanitizeElements', (node) => {
      // Remove data attributes that might contain scripts
      if ('attributes' in node && node.attributes) {
        Array.from(node.attributes as any).forEach((attr: any) => {
          if (attr && attr.name && attr.name.startsWith('data-') &&
              attr.value && /javascript:|data:|vbscript:/i.test(attr.value)) {
            if ('removeAttribute' in node) {
              (node as any).removeAttribute(attr.name);
            }
          }
        });
      }
    });

    DOMPurify.addHook('beforeSanitizeAttributes', (node) => {
      // Remove dangerous attribute values
      if (node.hasAttribute('href')) {
        const href = node.getAttribute('href');
        if (href && /^(javascript:|data:|vbscript:)/i.test(href)) {
          node.removeAttribute('href');
        }
      }
    });
  }

  /**
   * Deep sanitizes objects recursively
   */
  private deepSanitizeObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'string') {
        return this.sanitizeHTML(obj, { maxLength: 10000 });
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys
      const sanitizedKey = this.sanitizeHTML(key, {
        allowedTags: [],
        maxLength: 100
      });

      // Skip dangerous keys
      if (sanitizedKey && !this.isDangerousKey(sanitizedKey)) {
        sanitized[sanitizedKey] = this.deepSanitizeObject(value);
      }
    }

    return sanitized;
  }

  /**
   * Checks if a key is potentially dangerous
   */
  private isDangerousKey(key: string): boolean {
    const dangerousKeys = [
      '__proto__',
      'constructor',
      'prototype',
      'eval',
      'function',
      'script'
    ];

    return dangerousKeys.some(dangerous =>
      key.toLowerCase().includes(dangerous.toLowerCase())
    );
  }

  /**
   * Sanitizes relative URLs
   */
  private sanitizeRelativeURL(input: string): string {
    return input
      .replace(/\.\./g, '') // Remove parent directory references
      .replace(/[<>"']/g, '') // Remove potential XSS characters
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/data:/gi, ''); // Remove data protocol
  }

  /**
   * Checks if a hostname is an IP address
   */
  private isIPAddress(hostname: string): boolean {
    return validator.isIP(hostname);
  }

  /**
   * Logs sanitization operations
   */
  private logSanitization(type: string, originalLength: number, sanitizedLength: number): void {
    const key = `${type}_sanitized`;
    const current = this.sanitizationStats.get(key) || 0;
    this.sanitizationStats.set(key, current + 1);

    if (this.config.enableLogging) {
      console.log(`Sanitization [${type}]: ${originalLength} -> ${sanitizedLength} characters`);
    }
  }
}