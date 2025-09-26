/**
 * Jest configuration for @shell/cli package
 */

module.exports = {
  displayName: '@shell/cli',
  testEnvironment: 'node',

  // Root directory for this package
  rootDir: '.',

  // Module paths
  moduleNameMapper: {
    '^@shell/interfaces/(.*)$': '<rootDir>/../interfaces/src/$1',
    '^@shell/cli/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Transform files
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/test/**',
    '!src/**/mocks/**'
  ],

  // Coverage thresholds (80% target)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test patterns
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/**/?(*.)+(spec|test).{ts,tsx}'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/../../jest.setup.js'
  ],

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ]
};