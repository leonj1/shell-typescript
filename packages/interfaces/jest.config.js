/**
 * Jest configuration for @shell/interfaces package
 */

const baseConfig = require('../../jest.config.js');

module.exports = {
  // Inherit from base configuration but override specific settings
  displayName: '@shell/interfaces',
  testEnvironment: 'node',

  // Root directory for this package
  rootDir: '.',

  // Module paths
  moduleNameMapper: {
    '^@shell/interfaces/(.*)$': '<rootDir>/src/$1',
    '^@shell/(.*)$': '<rootDir>/../$1/src',
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Transform files with ts-jest
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Coverage settings specific to interfaces
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],

  // Coverage thresholds for interfaces (mostly type definitions)
  coverageThreshold: {
    global: {
      branches: 0, // Interfaces don't have branches
      functions: 0, // Interfaces don't have functions
      lines: 0, // Interfaces don't have executable lines
      statements: 0 // Interfaces don't have statements
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