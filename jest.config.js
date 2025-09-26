/**
 * Root Jest configuration for shell-typescript monorepo
 * This configuration serves as the base for all packages
 */

module.exports = {
  // Use projects to define workspace packages
  projects: [
    '<rootDir>/packages/interfaces',
    '<rootDir>/packages/shell',
    '<rootDir>/packages/cli'
  ],

  // Coverage collection settings
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],

  // Global coverage thresholds (80% target as per requirements)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Coverage collection patterns
  collectCoverageFrom: [
    'packages/**/src/**/*.{ts,tsx}',
    '!packages/**/src/**/*.d.ts',
    '!packages/**/src/**/index.ts',
    '!packages/**/src/**/*.stories.tsx',
    '!packages/**/src/**/*.test.ts',
    '!packages/**/src/**/*.spec.ts',
    '!packages/**/src/**/examples/**',
    '!packages/**/src/**/mocks/**',
    '!packages/**/src/**/test/**'
  ],

  // Test environment
  testEnvironment: 'node',

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform files with ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@shell/(.*)$': '<rootDir>/packages/$1/src',
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/?(*.)+(spec|test).{ts,tsx}'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],

  // Watch options for development
  watchman: true,
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output for better debugging
  verbose: true,

  // Error reporting
  bail: false,
  maxWorkers: '50%',

  // Timeout settings
  testTimeout: 10000
};