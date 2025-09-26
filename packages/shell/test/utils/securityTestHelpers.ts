/**
 * Specialized test helpers for security testing
 * Provides utilities for testing JWT tokens, CSP policies, and sanitization
 */

import { TokenClaims } from '@shell/interfaces';
import * as crypto from 'crypto';

/**
 * Security test vectors for common attack patterns
 */
export const SecurityTestVectors = {
  /**
   * XSS attack vectors for testing HTML sanitization
   */
  XSS_VECTORS: [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="alert(\'xss\')">',
    '<svg onload="alert(\'xss\')">',
    'javascript:alert("xss")',
    '<iframe src="javascript:alert(\'xss\')"></iframe>',
    '<object data="javascript:alert(\'xss\')"></object>',
    '<embed src="javascript:alert(\'xss\')">',
    '<link rel="stylesheet" href="javascript:alert(\'xss\')">',
    '<style>@import "javascript:alert(\'xss\')"</style>',
    '<div style="background:url(javascript:alert(\'xss\'))">',
    '<input type="text" onfocus="alert(\'xss\')" autofocus>',
    '<body onload="alert(\'xss\')">',
    '"><script>alert(\'xss\')</script>',
    '\';alert(\'xss\');//',
    '<script>eval(String.fromCharCode(97,108,101,114,116,40,39,120,115,115,39,41))</script>'
  ],

  /**
   * SQL injection vectors for testing SQL sanitization
   */
  SQL_INJECTION_VECTORS: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' UNION SELECT * FROM passwords --",
    "'; INSERT INTO users VALUES('hacker', 'pass'); --",
    "' OR 1=1 --",
    "admin'--",
    "admin'/*",
    "' OR 'x'='x",
    "') OR ('1'='1",
    "' AND (SELECT COUNT(*) FROM users) > 0 --",
    "'; EXEC xp_cmdshell('dir'); --",
    "1' AND SLEEP(5) --",
    "' OR (SELECT user FROM information_schema.processlist) --",
    "'; WAITFOR DELAY '00:00:05' --",
    "' OR BENCHMARK(5000000, MD5('test')) --"
  ],

  /**
   * Path traversal vectors for testing filename sanitization
   */
  PATH_TRAVERSAL_VECTORS: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '..%2F..%2F..%2Fetc%2Fpasswd',
    '..%252F..%252F..%252Fetc%252Fpasswd',
    'file:///etc/passwd',
    '\\\\server\\share\\file.txt',
    '/var/log/auth.log',
    'C:\\windows\\system32\\drivers\\etc\\hosts',
    '~/.ssh/id_rsa',
    '/proc/self/environ',
    '../.env',
    '../../config/database.yml',
    '..\\..\\web.config',
    '/.aws/credentials'
  ],

  /**
   * Malicious URLs for testing URL sanitization
   */
  MALICIOUS_URLS: [
    'javascript:alert("xss")',
    'data:text/html,<script>alert("xss")</script>',
    'vbscript:msgbox("xss")',
    'file:///etc/passwd',
    'ftp://malicious.com/virus.exe',
    'http://192.168.1.1:22',
    'https://malicious.com/redirect?url=http://victim.com',
    'ldap://malicious.com/dc=evil',
    'jar:http://malicious.com!/evil.class',
    'mailto:test@example.com?subject=<script>alert("xss")</script>',
    'tel:+1234567890"><script>alert("xss")</script>',
    'sms:+1234567890?body=<script>alert("xss")</script>',
    'intent://malicious.com#Intent;scheme=http;package=com.evil;end',
    '//malicious.com/evil.js',
    'http://evil.com@trusted.com/'
  ]
};

/**
 * Creates a properly formatted JWT token for testing
 */
export class JWTTestHelper {
  /**
   * Creates a valid JWT structure with custom claims
   */
  static createToken(claims: Partial<TokenClaims> = {}, options: {
    algorithm?: string;
    secret?: string;
    expired?: boolean;
  } = {}): string {
    const defaultClaims: TokenClaims = {
      sub: 'test-user-123',
      iss: 'https://test-issuer.com/',
      aud: 'test-audience',
      exp: options.expired ?
           Math.floor(Date.now() / 1000) - 3600 :
           Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      scope: 'read write',
      permissions: ['read', 'write'],
      roles: ['user'],
      ...claims
    };

    const header = {
      alg: options.algorithm || 'RS256',
      typ: 'JWT'
    };

    // Base64URL encode header and payload
    const encodedHeader = this.base64URLEncode(JSON.stringify(header));
    const encodedPayload = this.base64URLEncode(JSON.stringify(defaultClaims));

    // Create signature (simplified for testing)
    const signature = options.secret ?
                     this.createHMACSignature(`${encodedHeader}.${encodedPayload}`, options.secret) :
                     'mock-signature';

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Creates an invalid JWT token with specific malformation
   */
  static createInvalidToken(type: 'malformed' | 'missing-signature' | 'invalid-json' | 'none-algorithm' = 'malformed'): string {
    switch (type) {
      case 'malformed':
        return 'not.a.valid.jwt.token.with.too.many.parts';
      case 'missing-signature':
        return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.';
      case 'invalid-json':
        return 'invalid-base64.invalid-base64.signature';
      case 'none-algorithm':
        const header = { alg: 'none', typ: 'JWT' };
        const payload = { sub: 'test', exp: Math.floor(Date.now() / 1000) + 3600 };
        return `${this.base64URLEncode(JSON.stringify(header))}.${this.base64URLEncode(JSON.stringify(payload))}.`;
      default:
        return 'invalid-token';
    }
  }

  /**
   * Base64URL encoding helper
   */
  private static base64URLEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Creates HMAC signature for testing
   */
  private static createHMACSignature(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret)
                 .update(data)
                 .digest('base64')
                 .replace(/\+/g, '-')
                 .replace(/\//g, '_')
                 .replace(/=/g, '');
  }
}

/**
 * CSP test helper for generating and validating CSP policies
 */
export class CSPTestHelper {
  /**
   * Creates a test CSP policy with specified directives
   */
  static createPolicy(directives: Record<string, string[]>): string {
    const parts: string[] = [];

    Object.entries(directives).forEach(([directive, sources]) => {
      if (sources.length > 0) {
        parts.push(`${directive} ${sources.join(' ')}`);
      }
    });

    return parts.join('; ');
  }

  /**
   * Common CSP test policies
   */
  static get POLICIES() {
    return {
      STRICT: this.createPolicy({
        'default-src': ["'none'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"]
      }),

      PERMISSIVE: this.createPolicy({
        'default-src': ["'self'", '*'],
        'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ['*', 'data:', 'blob:']
      }),

      WITH_NONCE: (nonce: string) => this.createPolicy({
        'default-src': ["'self'"],
        'script-src': ["'self'", `'nonce-${nonce}'`],
        'style-src': ["'self'", `'nonce-${nonce}'`]
      }),

      INVALID: 'invalid-directive invalid-value; another-bad-directive'
    };
  }

  /**
   * Creates a mock CSP violation report
   */
  static createViolationReport(overrides: any = {}) {
    return {
      'document-uri': 'https://example.com/',
      'violated-directive': 'script-src',
      'blocked-uri': 'https://malicious.com/script.js',
      'line-number': 42,
      'column-number': 10,
      'source-file': 'https://example.com/page.html',
      'status-code': 200,
      'referrer': 'https://example.com/previous-page',
      ...overrides
    };
  }
}

/**
 * Performance testing helpers for security operations
 */
export class SecurityPerformanceHelper {
  /**
   * Measures the performance of a security operation
   */
  static async measureOperation<T>(
    operation: () => Promise<T>,
    name: string,
    expectedMaxMs: number = 1000
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await operation();
    const duration = performance.now() - startTime;

    if (duration > expectedMaxMs) {
      console.warn(`Security operation '${name}' took ${duration}ms, expected < ${expectedMaxMs}ms`);
    }

    return { result, duration };
  }

  /**
   * Tests for potential DoS vulnerabilities in sanitization
   */
  static createDoSTestCases() {
    return {
      LARGE_HTML: '<div>' + 'x'.repeat(100000) + '</div>',
      DEEPLY_NESTED: this.createDeeplyNestedHTML(1000),
      MANY_ATTRIBUTES: `<div ${'data-attr-'.repeat(1000)}="value">content</div>`,
      REGEX_BOMB: '(' + 'a'.repeat(10000) + ')*',
      LARGE_JSON: { data: 'x'.repeat(100000) }
    };
  }

  /**
   * Creates deeply nested HTML for testing
   */
  private static createDeeplyNestedHTML(depth: number): string {
    let html = '';
    for (let i = 0; i < depth; i++) {
      html += '<div>';
    }
    html += 'content';
    for (let i = 0; i < depth; i++) {
      html += '</div>';
    }
    return html;
  }
}

/**
 * Generates test data for security testing
 */
export class SecurityTestDataGenerator {
  /**
   * Generates a set of test users with different permission levels
   */
  static createTestUsers() {
    return {
      ADMIN: {
        id: 'admin-123',
        email: 'admin@test.com',
        name: 'Admin User',
        roles: ['admin', 'user'],
        permissions: ['*']
      },
      USER: {
        id: 'user-123',
        email: 'user@test.com',
        name: 'Regular User',
        roles: ['user'],
        permissions: ['read', 'write:own']
      },
      GUEST: {
        id: 'guest-123',
        email: 'guest@test.com',
        name: 'Guest User',
        roles: ['guest'],
        permissions: ['read']
      },
      SUSPENDED: {
        id: 'suspended-123',
        email: 'suspended@test.com',
        name: 'Suspended User',
        roles: ['suspended'],
        permissions: []
      }
    };
  }

  /**
   * Generates test configurations for different environments
   */
  static createEnvironmentConfigs() {
    return {
      DEVELOPMENT: {
        security: {
          strictMode: false,
          allowUnsafe: true,
          debugMode: true
        },
        csp: {
          reportOnly: true,
          allowInline: true
        }
      },
      PRODUCTION: {
        security: {
          strictMode: true,
          allowUnsafe: false,
          debugMode: false
        },
        csp: {
          reportOnly: false,
          allowInline: false
        }
      },
      TESTING: {
        security: {
          strictMode: true,
          allowUnsafe: false,
          debugMode: true
        },
        csp: {
          reportOnly: true,
          allowInline: false
        }
      }
    };
  }
}

/**
 * Assertion helpers for security testing
 */
export const SecurityAssertions = {
  /**
   * Asserts that a string is properly sanitized
   */
  assertSanitized(input: string, original: string) {
    expect(input).toBeSanitized(original);
  },

  /**
   * Asserts that a JWT token is valid
   */
  assertValidJWT(token: string) {
    expect(token).toBeValidJWT();
  },

  /**
   * Asserts that a CSP policy is valid
   */
  assertValidCSP(policy: string) {
    expect(policy).toBeValidCSPPolicy();
  },

  /**
   * Asserts that data is securely transported
   */
  assertSecureTransport(data: any) {
    expect(data).toBeSecurelyTransported();
  },

  /**
   * Asserts that no sensitive data is exposed
   */
  assertNoDataLeakage(data: any, sensitiveFields: string[]) {
    sensitiveFields.forEach(field => {
      expect(data).not.toHaveProperty(field);
    });
  }
};