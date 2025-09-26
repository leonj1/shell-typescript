/**
 * Test setup file for @shell/core package
 * This file runs before each test file in the shell package
 */

import '@testing-library/jest-dom';
import 'reflect-metadata';
import React from 'react';

// Extended Window interface for testing
declare global {
  interface Window {
    crypto: Crypto;
    DOMParser: typeof DOMParser;
  }
}

// Mock crypto for browser environment tests
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      encrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(16))),
      decrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(16))),
      generateKey: jest.fn(() => Promise.resolve({})),
      importKey: jest.fn(() => Promise.resolve({})),
      exportKey: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
    }
  }
});

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    reload: jest.fn(),
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    }
  })
}));

// Mock Next.js dynamic imports
jest.mock('next/dynamic', () => (component: any) => component);

// Mock Next.js Head component
jest.mock('next/head', () => {
  return function Head({ children }: { children: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  };
});

// Mock IntersectionObserver for component tests
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: []
}));

// Mock ResizeObserver for responsive components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // Only show React warnings and errors in tests when explicitly testing them
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      (args[0].includes('Warning') || args[0].includes('Error'))
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  console.warn = (...args: any[]) => {
    // Suppress React warnings in tests unless testing warning behavior
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      args[0].includes('Warning')
    ) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Clear all timers
  jest.useRealTimers();

  // Clear DOM
  document.body.innerHTML = '';

  // Clear any localStorage/sessionStorage
  localStorage.clear();
  sessionStorage.clear();
});

// Custom jest matchers for security testing
expect.extend({
  toBeSecurelyTransported(received: any) {
    const pass = received && (
      received.secure === true ||
      received.httpOnly === true ||
      (typeof received === 'string' && received.includes('Secure'))
    );

    if (pass) {
      return {
        message: () => `expected ${received} not to be securely transported`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be securely transported (have secure flags)`,
        pass: false
      };
    }
  },

  toHaveValidTokenStructure(received: any) {
    const pass = received &&
      typeof received === 'object' &&
      'accessToken' in received &&
      'tokenType' in received &&
      'expiresIn' in received;

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have valid token structure`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have valid token structure (accessToken, tokenType, expiresIn)`,
        pass: false
      };
    }
  },

  toBeValidCSPPolicy(received: string) {
    const cspPattern = /^[a-z-]+\s+[^;]+(?:;\s*[a-z-]+\s+[^;]+)*;?$/;
    const pass = typeof received === 'string' && cspPattern.test(received.trim());

    if (pass) {
      return {
        message: () => `expected "${received}" not to be a valid CSP policy`,
        pass: true
      };
    } else {
      return {
        message: () => `expected "${received}" to be a valid CSP policy format`,
        pass: false
      };
    }
  },

  toBeSanitized(received: string, original: string) {
    // Check if content has been sanitized (different from original and contains no scripts)
    const hasNoScript = !/<script/i.test(received);
    const hasNoOnEvents = !/\bon\w+\s*=/i.test(received);
    const hasNoJavascriptUrls = !/javascript:/i.test(received);
    const isDifferentFromOriginal = received !== original;

    const pass = hasNoScript && hasNoOnEvents && hasNoJavascriptUrls &&
                 (isDifferentFromOriginal || original === received);

    if (pass) {
      return {
        message: () => `expected "${received}" not to be sanitized`,
        pass: true
      };
    } else {
      return {
        message: () => `expected "${received}" to be properly sanitized (no scripts, event handlers, or javascript: urls)`,
        pass: false
      };
    }
  }
});