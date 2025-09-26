/**
 * Test utility functions and helpers for shell architecture testing
 */

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestServiceContainer, createMockServices } from '../mocks/createMockServices';
import {
  IServiceContainer,
  ServiceToken,
  ILogger,
  IAuthProvider,
  ITelemetryProvider,
  User,
  TokenSet,
  JWTValidationResult,
  TokenClaims
} from '@shell/interfaces';

/**
 * Extended render options with custom providers
 */
export interface TestRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  serviceContainer?: IServiceContainer;
  initialState?: any;
  user?: User;
  authenticated?: boolean;
}

/**
 * Enhanced render result with additional utilities
 */
export interface TestRenderResult extends RenderResult {
  user: ReturnType<typeof userEvent.setup>;
  container: IServiceContainer;
  mockServices: ReturnType<typeof createMockServices>;
}

/**
 * Custom render function with service provider wrapper
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: TestRenderOptions = {}
): TestRenderResult {
  const {
    serviceContainer = new TestServiceContainer(),
    user: mockUser,
    authenticated = false,
    ...renderOptions
  } = options;

  const mockServices = createMockServices();
  const user = userEvent.setup();

  // Configure authentication state if specified
  if (authenticated && mockUser) {
    mockServices.auth.getCurrentUser.mockResolvedValue(mockUser);
    mockServices.auth.isAuthenticated.mockResolvedValue(true);
    mockServices.auth.getAccessToken.mockResolvedValue('mock-token');
  }

  // Create wrapper component with providers
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Mock ServiceProvider component for testing
    return (
      <div data-testid="service-provider">
        {children}
      </div>
    );
  };

  const renderResult = render(ui, {
    wrapper: Wrapper,
    ...renderOptions
  });

  return {
    ...renderResult,
    user,
    container: serviceContainer,
    mockServices
  };
}

/**
 * Creates a mock JWT token for testing
 */
export function createMockJWTToken(overrides: Partial<TokenClaims> = {}): string {
  const defaultClaims: TokenClaims = {
    sub: 'test-user-123',
    iss: 'https://test.auth0.com/',
    aud: 'test-audience',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
    scope: 'read write',
    permissions: ['read', 'write'],
    roles: ['user'],
    ...overrides
  };

  // Create a mock JWT structure (header.payload.signature)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify(defaultClaims));
  const signature = 'mock-signature';

  return `${header}.${payload}.${signature}`;
}

/**
 * Creates a mock expired JWT token
 */
export function createExpiredJWTToken(overrides: Partial<TokenClaims> = {}): string {
  return createMockJWTToken({
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    ...overrides
  });
}

/**
 * Creates a malformed JWT token for testing error cases
 */
export function createMalformedJWTToken(): string {
  return 'not.a.valid.jwt.token';
}

/**
 * Creates mock user data for testing
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
    permissions: ['read', 'write'],
    metadata: {
      lastLogin: new Date(),
      createdAt: new Date(),
      department: 'Engineering',
      ...overrides.metadata
    },
    ...overrides
  };
}

/**
 * Creates mock token set for testing
 */
export function createMockTokenSet(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    accessToken: createMockJWTToken(),
    refreshToken: createMockJWTToken({ scope: 'offline_access' }),
    idToken: createMockJWTToken(),
    expiresIn: 3600,
    tokenType: 'Bearer',
    ...overrides
  };
}

/**
 * Waits for a specified amount of time in tests
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for the next tick in the event loop
 */
export function nextTick(): Promise<void> {
  return waitFor(0);
}

/**
 * Creates a mock file for upload testing
 */
export function createMockFile(
  filename: string = 'test.txt',
  content: string = 'test content',
  type: string = 'text/plain'
): File {
  const blob = new Blob([content], { type });
  return new File([blob], filename, { type });
}

/**
 * Creates a mock image file for testing
 */
export function createMockImageFile(
  filename: string = 'test.jpg',
  size: number = 1024
): File {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob!], filename, { type: 'image/jpeg' }));
    });
  }) as any; // Type assertion for test environment
}

/**
 * Mocks a successful async operation
 */
export function mockResolvedValue<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

/**
 * Mocks a failed async operation
 */
export function mockRejectedValue<T = any>(error: Error | string): Promise<T> {
  const err = typeof error === 'string' ? new Error(error) : error;
  return Promise.reject(err);
}

/**
 * Creates a spy on console methods for testing
 */
export function spyOnConsole() {
  const originalConsole = { ...console };

  const consoleSpy = {
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    info: jest.spyOn(console, 'info').mockImplementation(() => {}),
    debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),

    restore: () => {
      Object.assign(console, originalConsole);
      jest.restoreAllMocks();
    }
  };

  return consoleSpy;
}

/**
 * Asserts that a function throws with a specific message
 */
export async function expectToThrow(
  fn: () => any | Promise<any>,
  expectedError?: string | RegExp | Error
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error).toHaveProperty('message', expectedError);
      } else if (expectedError instanceof RegExp) {
        expect(error.message).toMatch(expectedError);
      } else if (expectedError instanceof Error) {
        expect(error).toEqual(expectedError);
      }
    }
  }
}

/**
 * Asserts that a promise resolves within a timeout
 */
export async function expectToResolve<T>(
  promise: Promise<T>,
  timeout: number = 5000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Promise did not resolve within ${timeout}ms`)), timeout)
    )
  ]);
}

/**
 * Creates a deferred promise for testing async flows
 */
export function createDeferred<T = any>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!
  };
}

/**
 * Utility to test component accessibility
 */
export function createAccessibilityTest(component: React.ReactElement) {
  return {
    async checkFocusManagement() {
      const { getByRole, getAllByRole } = renderWithProviders(component);

      // Check that interactive elements are focusable
      const buttons = getAllByRole('button');
      const inputs = getAllByRole('textbox');
      const links = getAllByRole('link');

      [...buttons, ...inputs, ...links].forEach(element => {
        expect(element).not.toHaveAttribute('tabIndex', '-1');
      });
    },

    async checkAriaLabels() {
      const { container } = renderWithProviders(component);

      // Check that form controls have labels
      const inputs = container.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        const hasLabel = input.hasAttribute('aria-label') ||
                         input.hasAttribute('aria-labelledby') ||
                         container.querySelector(`label[for="${input.id}"]`);
        expect(hasLabel).toBe(true);
      });
    },

    async checkKeyboardNavigation() {
      const { user } = renderWithProviders(component);

      // Test tab navigation
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
    }
  };
}

/**
 * Utility class for testing performance
 */
export class PerformanceTestHelper {
  private startTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    return performance.now() - this.startTime;
  }

  expectDuration(maxMs: number): void {
    const duration = this.end();
    expect(duration).toBeLessThan(maxMs);
  }

  static async measureAsyncOperation<T>(
    operation: () => Promise<T>,
    maxMs: number
  ): Promise<T> {
    const helper = new PerformanceTestHelper();
    helper.start();

    const result = await operation();
    helper.expectDuration(maxMs);

    return result;
  }
}