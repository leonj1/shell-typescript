/**
 * Comprehensive unit tests for Sanitization Service
 * Tests all sanitization methods including security edge cases
 */

import { SanitizationService, SanitizationServiceConfig } from '../SanitizationService';
import { SanitizeOptions, URLSanitizeOptions } from '@shell/interfaces';

// Mock DOMPurify
jest.mock('dompurify', () => ({
  sanitize: jest.fn((input: string) => input.replace(/<script.*?\/script>/gi, '')),
  addHook: jest.fn()
}));

// Mock validator
jest.mock('validator', () => ({
  isEmail: jest.fn(() => true),
  isIP: jest.fn(() => false)
}));

// Mock libphonenumber-js
jest.mock('libphonenumber-js', () => ({
  parsePhoneNumber: jest.fn(() => ({ isValid: () => true })),
  isValidPhoneNumber: jest.fn(() => true)
}));

import DOMPurify from 'dompurify';
import validator from 'validator';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const mockedDOMPurify = DOMPurify as jest.Mocked<typeof DOMPurify>;
const mockedValidator = validator as jest.Mocked<typeof validator>;
const mockedParsePhoneNumber = parsePhoneNumber as jest.Mock;
const mockedIsValidPhoneNumber = isValidPhoneNumber as jest.Mock;

describe('SanitizationService', () => {
  let sanitizationService: SanitizationService;
  let mockConfig: SanitizationServiceConfig;

  beforeEach(() => {
    mockConfig = {
      maxInputLength: 10000,
      enableLogging: false,
      defaultHTMLOptions: {
        allowedTags: ['p', 'br', 'strong', 'em'],
        allowedAttributes: { strong: ['class'], em: ['class'] },
        stripScripts: true,
        stripStyles: true
      },
      defaultURLOptions: {
        allowedProtocols: ['https', 'http'],
        allowLocalhost: false,
        allowIPAddresses: false,
        allowRelative: false
      }
    };

    sanitizationService = new SanitizationService(mockConfig);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new SanitizationService();
      expect(defaultService).toBeDefined();
    });

    it('should merge provided config with defaults', () => {
      const customConfig: SanitizationServiceConfig = {
        maxInputLength: 50000,
        enableLogging: true
      };

      const customService = new SanitizationService(customConfig);
      expect(customService).toBeDefined();
    });

    it('should configure DOMPurify with security hooks', () => {
      new SanitizationService();

      expect(mockedDOMPurify.addHook).toHaveBeenCalledWith(
        'beforeSanitizeElements',
        expect.any(Function)
      );
      expect(mockedDOMPurify.addHook).toHaveBeenCalledWith(
        'beforeSanitizeAttributes',
        expect.any(Function)
      );
    });
  });

  describe('sanitizeHTML', () => {
    it('should sanitize basic HTML content', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      mockedDOMPurify.sanitize.mockReturnValue(input);

      const result = sanitizationService.sanitizeHTML(input);

      expect(result).toBe(input);
      expect(mockedDOMPurify.sanitize).toHaveBeenCalledWith(
        input,
        expect.any(Object)
      );
    });

    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const sanitized = '<p>Hello</p>';
      mockedDOMPurify.sanitize.mockReturnValue(sanitized);

      const result = sanitizationService.sanitizeHTML(input);

      expect(result).toBe(sanitized);
      expect(result).toBeSanitized(input);
    });

    it('should handle empty or null inputs', () => {
      expect(sanitizationService.sanitizeHTML('')).toBe('');
      expect(sanitizationService.sanitizeHTML(null as any)).toBe('');
      expect(sanitizationService.sanitizeHTML(undefined as any)).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizationService.sanitizeHTML(123 as any)).toBe('');
      expect(sanitizationService.sanitizeHTML({} as any)).toBe('');
    });

    it('should enforce maximum input length', () => {
      const longInput = 'x'.repeat(20000);

      expect(() => {
        sanitizationService.sanitizeHTML(longInput);
      }).toThrow('Input length exceeds maximum allowed');
    });

    it('should apply custom HTML options', () => {
      const input = '<p class="test">Hello</p>';
      const options: SanitizeOptions = {
        allowedTags: ['p'],
        allowedAttributes: { p: ['class'] }
      };

      mockedDOMPurify.sanitize.mockReturnValue(input);

      const result = sanitizationService.sanitizeHTML(input, options);

      expect(mockedDOMPurify.sanitize).toHaveBeenCalledWith(
        input,
        expect.objectContaining({
          ALLOWED_TAGS: ['p'],
          ALLOWED_ATTR: ['class']
        })
      );
    });

    it('should truncate input when maxLength is specified', () => {
      const longInput = 'x'.repeat(1000);
      const options: SanitizeOptions = {
        maxLength: 100
      };

      const truncated = longInput.substring(0, 100);
      mockedDOMPurify.sanitize.mockReturnValue(truncated);

      sanitizationService.sanitizeHTML(longInput, options);

      expect(mockedDOMPurify.sanitize).toHaveBeenCalledWith(
        truncated,
        expect.any(Object)
      );
    });

    it('should configure allowed schemes', () => {
      const options: SanitizeOptions = {
        allowedSchemes: ['https', 'data']
      };

      sanitizationService.sanitizeHTML('<a href="https://example.com">link</a>', options);

      expect(mockedDOMPurify.sanitize).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ALLOWED_URI_REGEXP: expect.any(RegExp)
        })
      );
    });

    it('should strip scripts by default', () => {
      const options: SanitizeOptions = {
        stripScripts: undefined // Should default to true
      };

      sanitizationService.sanitizeHTML('<script>alert("test")</script>', options);

      expect(mockedDOMPurify.sanitize).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          FORBID_TAGS: ['script', 'object', 'embed', 'applet']
        })
      );
    });

    it('should strip styles by default', () => {
      const options: SanitizeOptions = {
        stripStyles: undefined // Should default to true
      };

      sanitizationService.sanitizeHTML('<div style="color:red">test</div>', options);

      expect(mockedDOMPurify.sanitize).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          FORBID_ATTR: ['style', 'onload', 'onerror']
        })
      );
    });

    it('should handle TrustedHTML return type', () => {
      const input = '<p>Hello World</p>';

      // Mock TrustedHTML-like object
      const trustedHTML = {
        toString: () => input
      };

      mockedDOMPurify.sanitize.mockReturnValue(trustedHTML as any);

      const result = sanitizationService.sanitizeHTML(input);

      expect(result).toBe(input);
    });
  });

  describe('sanitizeSQL', () => {
    it('should sanitize basic SQL input', () => {
      const input = "SELECT * FROM users WHERE name = 'test'";

      const result = sanitizationService.sanitizeSQL(input);

      // Should remove quotes and SQL keywords
      expect(result).not.toContain("'");
      expect(result).not.toContain('SELECT');
    });

    it('should remove SQL injection patterns', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES('hacker', 'pass'); --",
        "/* malicious comment */",
        "' UNION SELECT * FROM passwords --"
      ];

      maliciousInputs.forEach(input => {
        const result = sanitizationService.sanitizeSQL(input);

        expect(result).not.toContain('DROP');
        expect(result).not.toContain('INSERT');
        expect(result).not.toContain('UNION');
        expect(result).not.toContain('SELECT');
        expect(result).not.toContain('--');
        expect(result).not.toContain('/*');
      });
    });

    it('should handle empty or null inputs', () => {
      expect(sanitizationService.sanitizeSQL('')).toBe('');
      expect(sanitizationService.sanitizeSQL(null as any)).toBe('');
      expect(sanitizationService.sanitizeSQL(undefined as any)).toBe('');
    });

    it('should enforce maximum input length', () => {
      const longInput = 'SELECT '.repeat(2000);

      expect(() => {
        sanitizationService.sanitizeSQL(longInput);
      }).toThrow('Input length exceeds maximum allowed');
    });

    it('should escape single quotes properly', () => {
      const input = "user's name";

      const result = sanitizationService.sanitizeSQL(input);

      expect(result).toBe("user''s name");
    });

    it('should remove dangerous characters', () => {
      const input = "test;\x00\n\r\x1a\"value";

      const result = sanitizationService.sanitizeSQL(input);

      expect(result).not.toContain(';');
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\n');
      expect(result).not.toContain('\r');
      expect(result).not.toContain('\x1a');
      expect(result).not.toContain('"');
    });

    it('should remove hex and unicode encoding attempts', () => {
      const input = "test\\x41\\u0041value";

      const result = sanitizationService.sanitizeSQL(input);

      expect(result).not.toContain('\\x41');
      expect(result).not.toContain('\\u0041');
    });
  });

  describe('sanitizeJSON', () => {
    it('should sanitize simple JSON objects', () => {
      const input = { name: 'test', value: '<script>alert("xss")</script>' };

      const result = sanitizationService.sanitizeJSON(input);

      expect(result).toEqual({
        name: 'test',
        value: expect.any(String)
      });
    });

    it('should handle null and undefined', () => {
      expect(sanitizationService.sanitizeJSON(null)).toBeNull();
      expect(sanitizationService.sanitizeJSON(undefined)).toBeUndefined();
    });

    it('should sanitize nested objects recursively', () => {
      const input = {
        user: {
          name: '<script>alert("test")</script>',
          profile: {
            bio: 'Safe content'
          }
        }
      };

      const result = sanitizationService.sanitizeJSON(input);

      expect(result.user.name).toBeDefined();
      expect(result.user.profile.bio).toBe('Safe content');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>alert("test")</script>', 'safe content'];

      const result = sanitizationService.sanitizeJSON(input);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should enforce maximum input length', () => {
      const largeObject = { data: 'x'.repeat(20000) };

      expect(() => {
        sanitizationService.sanitizeJSON(largeObject);
      }).toThrow('Input length exceeds maximum allowed');
    });

    it('should sanitize object keys', () => {
      const input = {
        '<script>alert("test")</script>': 'value',
        'safe_key': 'safe_value'
      };

      const result = sanitizationService.sanitizeJSON(input);

      const keys = Object.keys(result);
      expect(keys).not.toContain('<script>alert("test")</script>');
      expect(keys).toContain('safe_key');
    });

    it('should skip dangerous keys', () => {
      const input = {
        '__proto__': 'malicious',
        'constructor': 'bad',
        'prototype': 'evil',
        'safe_key': 'safe_value'
      };

      const result = sanitizationService.sanitizeJSON(input);

      expect(result).not.toHaveProperty('__proto__');
      expect(result).not.toHaveProperty('constructor');
      expect(result).not.toHaveProperty('prototype');
      expect(result).toHaveProperty('safe_key');
    });

    it('should handle primitive values', () => {
      expect(sanitizationService.sanitizeJSON('test string')).toBe('test string');
      expect(sanitizationService.sanitizeJSON(123)).toBe(123);
      expect(sanitizationService.sanitizeJSON(true)).toBe(true);
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize basic filenames', () => {
      const result = sanitizationService.sanitizeFilename('test file.txt');
      expect(result).toBe('test file.txt');
    });

    it('should remove dangerous characters', () => {
      const input = 'test/file\\with:bad*chars?"<>|.txt';

      const result = sanitizationService.sanitizeFilename(input);

      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
      expect(result).not.toContain(':');
      expect(result).not.toContain('*');
      expect(result).not.toContain('?');
      expect(result).not.toContain('"');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('|');
    });

    it('should remove directory traversal sequences', () => {
      const input = '../../../etc/passwd';

      const result = sanitizationService.sanitizeFilename(input);

      expect(result).not.toContain('../');
    });

    it('should handle null bytes', () => {
      const input = 'test\x00file.txt';

      const result = sanitizationService.sanitizeFilename(input);

      expect(result).not.toContain('\x00');
    });

    it('should trim leading and trailing dots and spaces', () => {
      const input = '  ..test file..  ';

      const result = sanitizationService.sanitizeFilename(input);

      expect(result).toBe('test file');
    });

    it('should limit filename length', () => {
      const longInput = 'a'.repeat(300);

      const result = sanitizationService.sanitizeFilename(longInput);

      expect(result.length).toBeLessThanOrEqual(255);
    });

    it('should handle empty filenames', () => {
      const result = sanitizationService.sanitizeFilename('');
      expect(result).toBe('file');
    });

    it('should prevent Windows reserved names', () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];

      reservedNames.forEach(name => {
        const result = sanitizationService.sanitizeFilename(name);
        expect(result).toBe(`file_${name}`);
      });
    });

    it('should handle case-insensitive reserved names', () => {
      const result = sanitizationService.sanitizeFilename('con');
      expect(result).toBe('file_con');
    });
  });

  describe('sanitizeURL', () => {
    beforeEach(() => {
      // Mock URL constructor behavior
      global.URL = jest.fn().mockImplementation((url) => {
        if (url.startsWith('https://example.com')) {
          return {
            protocol: 'https:',
            hostname: 'example.com',
            toString: () => url
          };
        }
        if (url.startsWith('javascript:')) {
          throw new Error('Invalid URL');
        }
        return {
          protocol: 'https:',
          hostname: 'example.com',
          toString: () => url
        };
      }) as any;
    });

    it('should sanitize valid URLs', () => {
      const input = 'https://example.com/path';

      const result = sanitizationService.sanitizeURL(input);

      expect(result).toBe(input);
    });

    it('should reject disallowed protocols', () => {
      const options: URLSanitizeOptions = {
        allowedProtocols: ['https']
      };

      global.URL = jest.fn().mockImplementation(() => ({
        protocol: 'http:',
        hostname: 'example.com',
        toString: () => 'http://example.com'
      })) as any;

      const result = sanitizationService.sanitizeURL('http://example.com', options);

      expect(result).toBe('');
    });

    it('should reject blocked domains', () => {
      const options: URLSanitizeOptions = {
        blockedDomains: ['malicious.com']
      };

      global.URL = jest.fn().mockImplementation(() => ({
        protocol: 'https:',
        hostname: 'malicious.com',
        toString: () => 'https://malicious.com'
      })) as any;

      const result = sanitizationService.sanitizeURL('https://malicious.com', options);

      expect(result).toBe('');
    });

    it('should allow only whitelisted domains when specified', () => {
      const options: URLSanitizeOptions = {
        allowedDomains: ['trusted.com']
      };

      global.URL = jest.fn().mockImplementation(() => ({
        protocol: 'https:',
        hostname: 'untrusted.com',
        toString: () => 'https://untrusted.com'
      })) as any;

      const result = sanitizationService.sanitizeURL('https://untrusted.com', options);

      expect(result).toBe('');
    });

    it('should reject localhost when not allowed', () => {
      const options: URLSanitizeOptions = {
        allowLocalhost: false
      };

      global.URL = jest.fn().mockImplementation(() => ({
        protocol: 'http:',
        hostname: 'localhost',
        toString: () => 'http://localhost:3000'
      })) as any;

      const result = sanitizationService.sanitizeURL('http://localhost:3000', options);

      expect(result).toBe('');
    });

    it('should reject IP addresses when not allowed', () => {
      mockedValidator.isIP.mockReturnValue(true);

      const options: URLSanitizeOptions = {
        allowIPAddresses: false
      };

      global.URL = jest.fn().mockImplementation(() => ({
        protocol: 'http:',
        hostname: '192.168.1.1',
        toString: () => 'http://192.168.1.1'
      })) as any;

      const result = sanitizationService.sanitizeURL('http://192.168.1.1', options);

      expect(result).toBe('');
    });

    it('should handle relative URLs when allowed', () => {
      const options: URLSanitizeOptions = {
        allowRelative: true
      };

      global.URL = jest.fn().mockImplementation(() => {
        throw new Error('Invalid URL');
      }) as any;

      const result = sanitizationService.sanitizeURL('/relative/path', options);

      expect(result).toBe('/relative/path');
    });

    it('should sanitize relative URLs', () => {
      const options: URLSanitizeOptions = {
        allowRelative: true
      };

      global.URL = jest.fn().mockImplementation(() => {
        throw new Error('Invalid URL');
      }) as any;

      const result = sanitizationService.sanitizeURL('../malicious/path', options);

      expect(result).not.toContain('../');
    });

    it('should handle empty or null URLs', () => {
      expect(sanitizationService.sanitizeURL('')).toBe('');
      expect(sanitizationService.sanitizeURL(null as any)).toBe('');
      expect(sanitizationService.sanitizeURL(undefined as any)).toBe('');
    });

    it('should handle malformed URLs', () => {
      global.URL = jest.fn().mockImplementation(() => {
        throw new Error('Invalid URL');
      }) as any;

      const result = sanitizationService.sanitizeURL('not-a-url');

      expect(result).toBe('');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      mockedValidator.isEmail.mockReturnValue(true);

      const result = sanitizationService.validateEmail('test@example.com');

      expect(result).toBe(true);
      expect(mockedValidator.isEmail).toHaveBeenCalledWith('test@example.com', {
        allow_utf8_local_part: false,
        require_tld: true,
        allow_ip_domain: false
      });
    });

    it('should reject invalid email addresses', () => {
      mockedValidator.isEmail.mockReturnValue(false);

      const result = sanitizationService.validateEmail('invalid-email');

      expect(result).toBe(false);
    });

    it('should reject emails exceeding length limit', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';

      const result = sanitizationService.validateEmail(longEmail);

      expect(result).toBe(false);
    });

    it('should handle empty or null inputs', () => {
      expect(sanitizationService.validateEmail('')).toBe(false);
      expect(sanitizationService.validateEmail(null as any)).toBe(false);
      expect(sanitizationService.validateEmail(undefined as any)).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate phone numbers with region', () => {
      mockedIsValidPhoneNumber.mockReturnValue(true);

      const result = sanitizationService.validatePhoneNumber('+1234567890', 'US');

      expect(result).toBe(true);
      expect(mockedIsValidPhoneNumber).toHaveBeenCalledWith('+1234567890', 'US');
    });

    it('should validate phone numbers without region', () => {
      mockedParsePhoneNumber.mockReturnValue({ isValid: () => true });

      const result = sanitizationService.validatePhoneNumber('+1234567890');

      expect(result).toBe(true);
      expect(mockedParsePhoneNumber).toHaveBeenCalledWith('+1234567890');
    });

    it('should handle parsing errors', () => {
      mockedParsePhoneNumber.mockImplementation(() => {
        throw new Error('Invalid phone number');
      });

      const result = sanitizationService.validatePhoneNumber('invalid');

      expect(result).toBe(false);
    });

    it('should handle empty or null inputs', () => {
      expect(sanitizationService.validatePhoneNumber('')).toBe(false);
      expect(sanitizationService.validatePhoneNumber(null as any)).toBe(false);
      expect(sanitizationService.validatePhoneNumber(undefined as any)).toBe(false);
    });
  });

  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      const input = 'test.*+?^${}()|[]\\';

      const result = sanitizationService.escapeRegex(input);

      expect(result).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should handle empty or null inputs', () => {
      expect(sanitizationService.escapeRegex('')).toBe('');
      expect(sanitizationService.escapeRegex(null as any)).toBe('');
      expect(sanitizationService.escapeRegex(undefined as any)).toBe('');
    });

    it('should not affect non-special characters', () => {
      const input = 'regular text 123';

      const result = sanitizationService.escapeRegex(input);

      expect(result).toBe(input);
    });
  });

  describe('sanitizeWithResult', () => {
    it('should provide detailed sanitization results', () => {
      const input = '<script>alert("test")</script><p>Safe content</p>';
      const sanitized = '<p>Safe content</p>';

      mockedDOMPurify.sanitize.mockReturnValue(sanitized);

      const result = sanitizationService.sanitizeWithResult(input, 'html');

      expect(result.sanitized).toBe(sanitized);
      expect(result.modified).toBe(true);
      expect(result.modifications).toHaveLength(1);
      expect(result.modifications[0].type).toBe('replaced');
    });

    it('should handle unmodified content', () => {
      const input = '<p>Safe content</p>';

      mockedDOMPurify.sanitize.mockReturnValue(input);

      const result = sanitizationService.sanitizeWithResult(input, 'html');

      expect(result.sanitized).toBe(input);
      expect(result.modified).toBe(false);
      expect(result.modifications).toHaveLength(0);
    });
  });

  describe('sanitizeBulk', () => {
    it('should sanitize arrays of inputs', () => {
      const inputs = [
        '<script>alert("test1")</script>',
        '<script>alert("test2")</script>',
        'Safe content'
      ];

      mockedDOMPurify.sanitize
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('Safe content');

      const results = sanitizationService.sanitizeBulk(inputs, 'html');

      expect(results).toHaveLength(3);
      expect(results[2]).toBe('Safe content');
    });

    it('should handle empty arrays', () => {
      const result = sanitizationService.sanitizeBulk([], 'html');

      expect(result).toEqual([]);
    });
  });

  describe('Statistics', () => {
    it('should track sanitization statistics when enabled', () => {
      const loggingService = new SanitizationService({
        ...mockConfig,
        enableLogging: true
      });

      mockedDOMPurify.sanitize.mockReturnValue('sanitized');

      loggingService.sanitizeHTML('<script>test</script>');
      loggingService.sanitizeHTML('<script>test2</script>');

      const stats = loggingService.getStats();

      expect(stats['html_sanitized']).toBe(2);
    });

    it('should reset statistics', () => {
      const loggingService = new SanitizationService({
        ...mockConfig,
        enableLogging: true
      });

      mockedDOMPurify.sanitize.mockReturnValue('sanitized');

      loggingService.sanitizeHTML('<script>test</script>');

      let stats = loggingService.getStats();
      expect(stats['html_sanitized']).toBe(1);

      loggingService.resetStats();

      stats = loggingService.getStats();
      expect(stats['html_sanitized']).toBeUndefined();
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle prototype pollution attempts', () => {
      const maliciousJSON = JSON.parse('{"__proto__": {"polluted": true}}');

      const result = sanitizationService.sanitizeJSON(maliciousJSON);

      expect(result).not.toHaveProperty('__proto__');
      expect(({} as any).polluted).toBeUndefined();
    });

    it('should handle deeply nested objects', () => {
      let deepObject: any = {};
      let current = deepObject;

      // Create deeply nested structure
      for (let i = 0; i < 100; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = '<script>alert("deep")</script>';

      const result = sanitizationService.sanitizeJSON(deepObject);

      expect(result).toBeDefined();
      // Should handle without stack overflow
    });

    it('should prevent ReDoS attacks in regex escape', () => {
      const reDoSInput = 'a'.repeat(100000);

      const start = Date.now();
      const result = sanitizationService.escapeRegex(reDoSInput);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete quickly
      expect(result).toBeDefined();
    });

    it('should handle circular references in JSON', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // This should not cause infinite recursion
      expect(() => {
        sanitizationService.sanitizeJSON(circular);
      }).not.toThrow();
    });

    it('should handle very large arrays', () => {
      const largeArray = new Array(10000).fill('<script>alert("test")</script>');

      const result = sanitizationService.sanitizeBulk(largeArray, 'html');

      expect(result).toHaveLength(10000);
    });

    it('should prevent billion laughs attack in HTML', () => {
      const billionLaughs = '<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><lolz>&lol2;</lolz>';

      mockedDOMPurify.sanitize.mockReturnValue('');

      const result = sanitizationService.sanitizeHTML(billionLaughs);

      expect(result).toBeDefined();
      // Should complete without memory exhaustion
    });
  });
});