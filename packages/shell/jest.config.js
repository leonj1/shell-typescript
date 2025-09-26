/**
 * Jest configuration for @shell/core package
 */

module.exports = {
  displayName: '@shell/core',
  testEnvironment: 'jsdom', // Use jsdom for React components

  // Root directory for this package
  rootDir: '.',

  // Module paths
  moduleNameMapper: {
    '^@shell/interfaces/(.*)$': '<rootDir>/../interfaces/src/$1',
    '^@shell/core/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/test/mocks/fileMock.js'
  },

  // Transform files
  preset: 'ts-jest',

  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/examples/**',
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
    },
    // Specific thresholds for security modules
    'src/implementations/security/': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    },
    // Lower threshold for React components (due to JSX complexity)
    'src/components/': {
      branches: 70,
      functions: 75,
      lines: 70,
      statements: 70
    }
  },

  // Test patterns
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/**/?(*.)+(spec|test).{ts,tsx}'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts',
    '<rootDir>/../../jest.setup.js'
  ],

  // TypeScript configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.next/'
  ],

  // Environment setup for React Testing Library
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },

  // Mock static assets - this section is already covered above, removing duplicate
};