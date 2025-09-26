/**
 * Global Jest setup file for shell-typescript monorepo
 * This file runs before all test files
 */

// Import reflect-metadata for dependency injection
require('reflect-metadata');

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock crypto module for Node.js environment
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomBytes: (size) => {
      const array = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    createHash: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked-hash')
    })
  },
  writable: true
});

// Mock fetch if not available (for CSP violation reporting tests)
if (!globalThis.fetch) {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      statusText: 'OK',
      json: () => Promise.resolve({})
    })
  );
}

// Mock window object for CSP and browser-related tests
Object.defineProperty(globalThis, 'window', {
  value: {
    location: {
      href: 'http://localhost:3000'
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  },
  writable: true
});

// Mock navigator for user agent tests
Object.defineProperty(globalThis, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Environment) Jest/1.0'
  },
  writable: true
});

// Mock DOMParser for HTML sanitization tests
global.DOMParser = class MockDOMParser {
  parseFromString(html) {
    return {
      documentElement: {
        innerHTML: html
      }
    };
  }
};

// Mock document for DOM-related tests
Object.defineProperty(globalThis, 'document', {
  value: {
    createElement: jest.fn(() => ({
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      hasAttribute: jest.fn(),
      appendChild: jest.fn()
    })),
    head: {
      appendChild: jest.fn()
    }
  },
  writable: true
});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Cleanup after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();

  // Clear all mocks
  jest.clearAllMocks();

  // Reset modules
  jest.resetModules();
});

// Global error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Custom matchers for better assertions
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
    const pass = typeof received === 'string' && jwtRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT format`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT format`,
        pass: false
      };
    }
  },

  toBeValidCSPDirective(received) {
    const cspRegex = /^[a-z-]+\s+.+$/;
    const pass = typeof received === 'string' && cspRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid CSP directive`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid CSP directive`,
        pass: false
      };
    }
  }
});