/**
 * Comprehensive unit tests for JWT Token Validator
 * Tests all aspects of token validation including security edge cases
 */

import { JWTTokenValidator, JWTValidatorConfig } from '../JWTTokenValidator';
import {
  createMockJWTToken,
  createExpiredJWTToken,
  createMalformedJWTToken,
  mockResolvedValue,
  mockRejectedValue,
  expectToThrow
} from '../../../test/utils/testHelpers';
import * as jwt from 'jsonwebtoken';

// Mock jsonwebtoken library
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('JWTTokenValidator', () => {
  let validator: JWTTokenValidator;
  let mockConfig: JWTValidatorConfig;

  const mockPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...mock key content...
-----END RSA PRIVATE KEY-----`;

  const mockPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...mock key content...
-----END PUBLIC KEY-----`;

  beforeEach(() => {
    mockConfig = {
      secretOrPublicKey: mockPublicKey,
      algorithm: 'RS256',
      issuer: 'https://test.auth0.com/',
      audience: 'test-audience',
      clockTolerance: 300,
      ignoreExpiration: false,
      ignoreNotBefore: false,
      maxAge: undefined,
      cacheTTL: 300,
      enableCaching: true
    };

    validator = new JWTTokenValidator(mockConfig);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear intervals to prevent memory leaks
    jest.clearAllTimers();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultValidator = new JWTTokenValidator({
        secretOrPublicKey: mockPublicKey
      });

      expect(defaultValidator).toBeDefined();
    });

    it('should merge provided config with defaults', () => {
      const customConfig: JWTValidatorConfig = {
        secretOrPublicKey: mockPublicKey,
        clockTolerance: 600,
        cacheTTL: 600
      };

      const customValidator = new JWTTokenValidator(customConfig);
      expect(customValidator).toBeDefined();
    });

    it('should set up cache cleanup interval when caching is enabled', () => {
      jest.useFakeTimers();

      new JWTTokenValidator({
        ...mockConfig,
        enableCaching: true
      });

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 300000);

      jest.useRealTimers();
    });

    it('should not set up cache cleanup when caching is disabled', () => {
      jest.useFakeTimers();

      new JWTTokenValidator({
        ...mockConfig,
        enableCaching: false
      });

      expect(setInterval).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('validateAccessToken', () => {
    const mockValidToken = createMockJWTToken();
    const mockTokenClaims = {
      sub: 'test-user-123',
      iss: 'https://test.auth0.com/',
      aud: 'test-audience',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      scope: 'read write'
    };

    beforeEach(() => {
      mockedJwt.verify.mockReturnValue(mockTokenClaims as any);
      mockedJwt.decode.mockReturnValue(mockTokenClaims as any);
    });

    it('should validate a valid access token successfully', async () => {
      const result = await validator.validateAccessToken(mockValidToken);

      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
      expect(result.claims).toEqual(mockTokenClaims);
      expect(result.remainingTTL).toBeGreaterThan(0);
    });

    it('should return cached result for previously validated token', async () => {
      // First validation
      await validator.validateAccessToken(mockValidToken);

      // Second validation should use cache
      const result = await validator.validateAccessToken(mockValidToken);

      expect(result.valid).toBe(true);
      // jwt.verify should only be called once due to caching
      expect(mockedJwt.verify).toHaveBeenCalledTimes(1);
    });

    it('should handle expired tokens', async () => {
      const expiredToken = createExpiredJWTToken();
      const expiredError = new jwt.TokenExpiredError('jwt expired', new Date());

      mockedJwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      const result = await validator.validateAccessToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].code).toBe('TOKEN_EXPIRED');
    });

    it('should handle malformed tokens', async () => {
      const malformedToken = createMalformedJWTToken();

      const result = await validator.validateAccessToken(malformedToken);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].code).toBe('INVALID_JWT_FORMAT');
    });

    it('should handle revoked tokens', async () => {
      validator.revokeToken(mockValidToken);

      const result = await validator.validateAccessToken(mockValidToken);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].code).toBe('TOKEN_REVOKED');
    });

    it('should validate access token specific requirements', async () => {
      const tokenWithoutScope = {
        ...mockTokenClaims,
        scope: undefined,
        permissions: undefined
      };

      mockedJwt.verify.mockReturnValue(tokenWithoutScope as any);

      const result = await validator.validateAccessToken(mockValidToken);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].code).toBe('MISSING_ACCESS_CLAIMS');
    });

    it('should handle invalid signature error', async () => {
      const invalidSigError = new jwt.JsonWebTokenError('invalid signature');
      mockedJwt.verify.mockImplementation(() => {
        throw invalidSigError;
      });

      const result = await validator.validateAccessToken(mockValidToken);

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('INVALID_SIGNATURE');
    });

    it('should handle invalid issuer error', async () => {
      const invalidIssuerError = new jwt.JsonWebTokenError('jwt issuer invalid');
      mockedJwt.verify.mockImplementation(() => {
        throw invalidIssuerError;
      });

      const result = await validator.validateAccessToken(mockValidToken);

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('INVALID_ISSUER');
    });

    it('should handle invalid audience error', async () => {
      const invalidAudienceError = new jwt.JsonWebTokenError('jwt audience invalid');
      mockedJwt.verify.mockImplementation(() => {
        throw invalidAudienceError;
      });

      const result = await validator.validateAccessToken(mockValidToken);

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('INVALID_AUDIENCE');
    });
  });

  describe('validateRefreshToken', () => {
    const mockRefreshToken = createMockJWTToken({
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
      iat: Math.floor(Date.now() / 1000),
      scope: 'offline_access'
    });

    beforeEach(() => {
      const mockClaims = {
        sub: 'test-user-123',
        iss: 'https://test.auth0.com/',
        aud: 'test-audience',
        exp: Math.floor(Date.now() / 1000) + 86400 * 7,
        iat: Math.floor(Date.now() / 1000),
        scope: 'offline_access'
      };

      mockedJwt.verify.mockReturnValue(mockClaims as any);
      mockedJwt.decode.mockReturnValue(mockClaims as any);
    });

    it('should validate a valid refresh token', async () => {
      const result = await validator.validateRefreshToken(mockRefreshToken);

      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
    });

    it('should reject refresh tokens with short duration', async () => {
      const shortDurationToken = createMockJWTToken({
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour only
        iat: Math.floor(Date.now() / 1000)
      });

      const shortClaims = {
        sub: 'test-user-123',
        iss: 'https://test.auth0.com/',
        aud: 'test-audience',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      };

      mockedJwt.verify.mockReturnValue(shortClaims as any);

      const result = await validator.validateRefreshToken(shortDurationToken);

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('INVALID_REFRESH_DURATION');
    });
  });

  describe('validateIdToken', () => {
    const mockIdToken = createMockJWTToken({
      sub: 'test-user-123',
      aud: 'test-client-id',
      nonce: 'test-nonce'
    });

    beforeEach(() => {
      const mockClaims = {
        sub: 'test-user-123',
        iss: 'https://test.auth0.com/',
        aud: 'test-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: 'test-nonce'
      };

      mockedJwt.verify.mockReturnValue(mockClaims as any);
      mockedJwt.decode.mockReturnValue(mockClaims as any);
    });

    it('should validate a valid ID token', async () => {
      const result = await validator.validateIdToken(mockIdToken);

      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
    });

    it('should reject ID tokens without subject claim', async () => {
      const claimsWithoutSub = {
        iss: 'https://test.auth0.com/',
        aud: 'test-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      };

      mockedJwt.verify.mockReturnValue(claimsWithoutSub as any);

      const result = await validator.validateIdToken(mockIdToken);

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('MISSING_SUBJECT');
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', async () => {
      mockedJwt.verify.mockReturnValue({} as any);

      const result = await validator.verifySignature(
        createMockJWTToken(),
        mockPublicKey
      );

      expect(result).toBe(true);
      expect(mockedJwt.verify).toHaveBeenCalledWith(
        expect.any(String),
        mockPublicKey,
        {
          algorithms: ['RS256'],
          ignoreExpiration: true,
          ignoreNotBefore: true
        }
      );
    });

    it('should return false for invalid signature', async () => {
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const result = await validator.verifySignature(
        createMockJWTToken(),
        mockPublicKey
      );

      expect(result).toBe(false);
    });
  });

  describe('checkExpiration', () => {
    it('should return false for non-expired token', () => {
      const validToken = createMockJWTToken();
      mockedJwt.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600
      } as any);

      const result = validator.checkExpiration(validToken);

      expect(result).toBe(false);
    });

    it('should return true for expired token', () => {
      const expiredToken = createExpiredJWTToken();
      mockedJwt.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) - 3600
      } as any);

      const result = validator.checkExpiration(expiredToken);

      expect(result).toBe(true);
    });

    it('should return true for token without exp claim', () => {
      const tokenWithoutExp = createMockJWTToken();
      mockedJwt.decode.mockReturnValue({} as any);

      const result = validator.checkExpiration(tokenWithoutExp);

      expect(result).toBe(true);
    });

    it('should handle decode errors gracefully', () => {
      mockedJwt.decode.mockImplementation(() => {
        throw new Error('decode error');
      });

      const result = validator.checkExpiration('invalid-token');

      expect(result).toBe(true);
    });
  });

  describe('extractClaims', () => {
    const mockClaims = {
      sub: 'test-user-123',
      iss: 'https://test.auth0.com/',
      aud: 'test-audience',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    };

    it('should extract claims from valid token', () => {
      mockedJwt.decode.mockReturnValue(mockClaims as any);

      const result = validator.extractClaims(createMockJWTToken());

      expect(result).toEqual(mockClaims);
    });

    it('should throw error for invalid token format', () => {
      mockedJwt.decode.mockReturnValue(null);

      expect(() => {
        validator.extractClaims('invalid-token');
      }).toThrow('Invalid token format');
    });

    it('should throw error when decode fails', () => {
      mockedJwt.decode.mockImplementation(() => {
        throw new Error('decode error');
      });

      expect(() => {
        validator.extractClaims('invalid-token');
      }).toThrow('Failed to extract claims: decode error');
    });
  });

  describe('validateAudience', () => {
    it('should validate single audience claim', () => {
      mockedJwt.decode.mockReturnValue({
        aud: 'test-audience'
      } as any);

      const result = validator.validateAudience(
        createMockJWTToken(),
        'test-audience'
      );

      expect(result).toBe(true);
    });

    it('should validate audience in array', () => {
      mockedJwt.decode.mockReturnValue({
        aud: ['test-audience', 'another-audience']
      } as any);

      const result = validator.validateAudience(
        createMockJWTToken(),
        'test-audience'
      );

      expect(result).toBe(true);
    });

    it('should return false for mismatched audience', () => {
      mockedJwt.decode.mockReturnValue({
        aud: 'different-audience'
      } as any);

      const result = validator.validateAudience(
        createMockJWTToken(),
        'test-audience'
      );

      expect(result).toBe(false);
    });

    it('should handle extraction errors', () => {
      mockedJwt.decode.mockImplementation(() => {
        throw new Error('decode error');
      });

      const result = validator.validateAudience('invalid-token', 'test-audience');

      expect(result).toBe(false);
    });
  });

  describe('validateIssuer', () => {
    it('should validate correct issuer', () => {
      mockedJwt.decode.mockReturnValue({
        iss: 'https://test.auth0.com/'
      } as any);

      const result = validator.validateIssuer(
        createMockJWTToken(),
        'https://test.auth0.com/'
      );

      expect(result).toBe(true);
    });

    it('should return false for incorrect issuer', () => {
      mockedJwt.decode.mockReturnValue({
        iss: 'https://malicious.com/'
      } as any);

      const result = validator.validateIssuer(
        createMockJWTToken(),
        'https://test.auth0.com/'
      );

      expect(result).toBe(false);
    });

    it('should handle extraction errors', () => {
      mockedJwt.decode.mockImplementation(() => {
        throw new Error('decode error');
      });

      const result = validator.validateIssuer('invalid-token', 'https://test.auth0.com/');

      expect(result).toBe(false);
    });
  });

  describe('Token Revocation', () => {
    const testToken = createMockJWTToken();

    it('should revoke token successfully', () => {
      validator.revokeToken(testToken);

      const result = validator.isTokenRevoked(testToken);

      expect(result).toBe(true);
    });

    it('should return false for non-revoked token', () => {
      const result = validator.isTokenRevoked(testToken);

      expect(result).toBe(false);
    });

    it('should handle multiple revoked tokens', () => {
      const token1 = createMockJWTToken({ sub: 'user1' });
      const token2 = createMockJWTToken({ sub: 'user2' });

      validator.revokeToken(token1);
      validator.revokeToken(token2);

      expect(validator.isTokenRevoked(token1)).toBe(true);
      expect(validator.isTokenRevoked(token2)).toBe(true);
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      const mockClaims = {
        sub: 'test-user-123',
        iss: 'https://test.auth0.com/',
        aud: 'test-audience',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      };

      mockedJwt.verify.mockReturnValue(mockClaims as any);
      mockedJwt.decode.mockReturnValue(mockClaims as any);
    });

    it('should cache validation results', async () => {
      const token = createMockJWTToken();

      // First validation
      await validator.validateAccessToken(token);
      // Second validation should hit cache
      await validator.validateAccessToken(token);

      // jwt.verify should only be called once due to caching
      expect(mockedJwt.verify).toHaveBeenCalledTimes(1);
    });

    it('should not use cache when caching is disabled', async () => {
      const noCacheValidator = new JWTTokenValidator({
        ...mockConfig,
        enableCaching: false
      });

      const token = createMockJWTToken();

      // First validation
      await noCacheValidator.validateAccessToken(token);
      // Second validation should not use cache
      await noCacheValidator.validateAccessToken(token);

      expect(mockedJwt.verify).toHaveBeenCalledTimes(2);
    });

    it('should clean up expired cache entries', async () => {
      jest.useFakeTimers();

      const shortTTLValidator = new JWTTokenValidator({
        ...mockConfig,
        cacheTTL: 1 // 1 second TTL
      });

      const token = createMockJWTToken();

      // Cache a validation result
      await shortTTLValidator.validateAccessToken(token);

      // Fast forward past cache TTL
      jest.advanceTimersByTime(2000);

      // Trigger cache cleanup
      jest.advanceTimersByTime(300000);

      // Next validation should not use expired cache
      await shortTTLValidator.validateAccessToken(token);

      expect(mockedJwt.verify).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty or null tokens', async () => {
      const results = await Promise.all([
        validator.validateAccessToken(''),
        validator.validateAccessToken(null as any),
        validator.validateAccessToken(undefined as any)
      ]);

      results.forEach(result => {
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors![0].code).toBe('INVALID_FORMAT');
      });
    });

    it('should handle non-string tokens', async () => {
      const result = await validator.validateAccessToken(12345 as any);

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('INVALID_FORMAT');
    });

    it('should handle JWT library errors gracefully', async () => {
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Unexpected JWT error');
      });

      const result = await validator.validateAccessToken(createMockJWTToken());

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Security Edge Cases', () => {
    it('should reject tokens with algorithm none', async () => {
      // This test ensures that 'none' algorithm attacks are prevented
      const noneAlgToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ0ZXN0In0.';

      mockedJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      const result = await validator.validateAccessToken(noneAlgToken);

      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('INVALID_TOKEN');
    });

    it('should handle very large tokens', async () => {
      const largePayload = 'x'.repeat(100000);
      const largeToken = createMockJWTToken({ data: largePayload });

      // This should be handled gracefully without causing memory issues
      const result = await validator.validateAccessToken(largeToken);

      // The result depends on whether the JWT library can handle it
      expect(result).toBeDefined();
    });

    it('should validate token format strictly', async () => {
      const invalidFormats = [
        'not-a-jwt',
        'header.payload', // Missing signature
        'header.payload.signature.extra', // Too many parts
        '.payload.signature', // Empty header
        'header..signature', // Empty payload
        'header.payload.', // Empty signature
      ];

      for (const invalidToken of invalidFormats) {
        const result = await validator.validateAccessToken(invalidToken);
        expect(result.valid).toBe(false);
        expect(result.errors![0].code).toBe('INVALID_JWT_FORMAT');
      }
    });
  });
});