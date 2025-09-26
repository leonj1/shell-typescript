import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import {
  ITokenValidator,
  JWTValidationResult,
  TokenClaims,
  ValidationError
} from '@shell/interfaces';

/**
 * Configuration for JWT token validation
 */
export interface JWTValidatorConfig {
  /** Secret key or public key for signature verification */
  secretOrPublicKey: string | Buffer;

  /** Algorithm for signature verification (default: RS256) */
  algorithm?: jwt.Algorithm;

  /** Expected issuer */
  issuer?: string;

  /** Expected audience */
  audience?: string | string[];

  /** Clock tolerance in seconds (default: 300) */
  clockTolerance?: number;

  /** Whether to ignore expiration (default: false) */
  ignoreExpiration?: boolean;

  /** Whether to ignore not before (default: false) */
  ignoreNotBefore?: boolean;

  /** Maximum token age in seconds */
  maxAge?: number;

  /** Cache TTL for validated tokens in seconds (default: 300) */
  cacheTTL?: number;

  /** Enable token caching (default: true) */
  enableCaching?: boolean;
}

/**
 * Cache entry for validated tokens
 */
interface CachedValidationResult {
  result: JWTValidationResult;
  expiry: number;
}

/**
 * Production-ready JWT token validator with caching and comprehensive validation
 */
export class JWTTokenValidator implements ITokenValidator {
  private config: JWTValidatorConfig & {
    algorithm: jwt.Algorithm;
    clockTolerance: number;
    ignoreExpiration: boolean;
    ignoreNotBefore: boolean;
    cacheTTL: number;
    enableCaching: boolean;
  };
  private validationCache = new Map<string, CachedValidationResult>();
  private revocationList = new Set<string>();

  constructor(config: JWTValidatorConfig) {
    this.config = {
      algorithm: 'RS256',
      clockTolerance: 300,
      ignoreExpiration: false,
      ignoreNotBefore: false,
      maxAge: undefined,
      cacheTTL: 300,
      enableCaching: true,
      issuer: '',
      audience: '',
      ...config
    };

    // Clean up expired cache entries every 5 minutes
    if (this.config.enableCaching) {
      setInterval(() => this.cleanupCache(), 300000);
    }
  }

  /**
   * Validates an access token with comprehensive security checks
   */
  async validateAccessToken(token: string): Promise<JWTValidationResult> {
    return this.validateToken(token, 'access');
  }

  /**
   * Validates a refresh token
   */
  async validateRefreshToken(token: string): Promise<JWTValidationResult> {
    return this.validateToken(token, 'refresh');
  }

  /**
   * Validates an ID token
   */
  async validateIdToken(token: string): Promise<JWTValidationResult> {
    return this.validateToken(token, 'id');
  }

  /**
   * Verifies the cryptographic signature of a token
   */
  async verifySignature(token: string, publicKey: string): Promise<boolean> {
    try {
      jwt.verify(token, publicKey, {
        algorithms: [this.config.algorithm],
        ignoreExpiration: true,
        ignoreNotBefore: true,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks if a token is expired without full validation
   */
  checkExpiration(token: string): boolean {
    try {
      const decoded = jwt.decode(token, { json: true });
      if (!decoded || typeof decoded !== 'object' || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp <= now;
    } catch (error) {
      return true;
    }
  }

  /**
   * Extracts claims from a token without validation
   */
  extractClaims(token: string): TokenClaims {
    try {
      const decoded = jwt.decode(token, { json: true });
      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Invalid token format');
      }

      return decoded as TokenClaims;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract claims: ${errorMessage}`);
    }
  }

  /**
   * Validates the audience claim
   */
  validateAudience(token: string, expectedAudience: string): boolean {
    try {
      const claims = this.extractClaims(token);
      const aud = claims.aud;

      if (Array.isArray(aud)) {
        return aud.includes(expectedAudience);
      }

      return aud === expectedAudience;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates the issuer claim
   */
  validateIssuer(token: string, expectedIssuer: string): boolean {
    try {
      const claims = this.extractClaims(token);
      return claims.iss === expectedIssuer;
    } catch (error) {
      return false;
    }
  }

  /**
   * Adds a token to the revocation list
   */
  revokeToken(token: string): void {
    const tokenHash = this.hashToken(token);
    this.revocationList.add(tokenHash);
  }

  /**
   * Checks if a token has been revoked
   */
  isTokenRevoked(token: string): boolean {
    const tokenHash = this.hashToken(token);
    return this.revocationList.has(tokenHash);
  }

  /**
   * Core token validation logic with caching
   */
  private async validateToken(token: string, tokenType: 'access' | 'refresh' | 'id'): Promise<JWTValidationResult> {
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedResult(token);
      if (cached) {
        return cached;
      }
    }

    // Validate token format
    const formatValidation = this.validateTokenFormat(token);
    if (!formatValidation.valid) {
      return formatValidation;
    }

    // Check revocation
    if (this.isTokenRevoked(token)) {
      return {
        valid: false,
        expired: false,
        errors: [{ code: 'TOKEN_REVOKED', message: 'Token has been revoked' }]
      };
    }

    // Perform JWT validation
    const jwtValidation = await this.performJWTValidation(token);
    if (!jwtValidation.valid) {
      return jwtValidation;
    }

    // Additional token type specific validation
    const typeValidation = this.validateTokenType(jwtValidation.claims!, tokenType);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    // Calculate remaining TTL
    const remainingTTL = this.calculateRemainingTTL(jwtValidation.claims!);

    const result: JWTValidationResult = {
      valid: true,
      expired: false,
      claims: jwtValidation.claims,
      remainingTTL
    };

    // Cache the result
    if (this.config.enableCaching) {
      this.cacheResult(token, result);
    }

    return result;
  }

  /**
   * Validates basic token format
   */
  private validateTokenFormat(token: string): JWTValidationResult {
    const errors: ValidationError[] = [];

    if (!token || typeof token !== 'string') {
      errors.push({ code: 'INVALID_FORMAT', message: 'Token must be a non-empty string' });
    }

    if (token && !token.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/)) {
      errors.push({ code: 'INVALID_JWT_FORMAT', message: 'Token is not in valid JWT format' });
    }

    return {
      valid: errors.length === 0,
      expired: false,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Performs comprehensive JWT validation
   */
  private async performJWTValidation(token: string): Promise<JWTValidationResult> {
    try {
      const options: jwt.VerifyOptions = {
        algorithms: [this.config.algorithm],
        clockTolerance: this.config.clockTolerance,
        ignoreExpiration: this.config.ignoreExpiration,
        ignoreNotBefore: this.config.ignoreNotBefore
      };

      if (this.config.issuer && this.config.issuer !== '') {
        options.issuer = this.config.issuer;
      }

      if (this.config.audience && this.config.audience !== '') {
        options.audience = this.config.audience as any;
      }

      if (this.config.maxAge) {
        options.maxAge = this.config.maxAge;
      }

      const decoded = jwt.verify(token, this.config.secretOrPublicKey, options) as TokenClaims;

      return {
        valid: true,
        expired: false,
        claims: decoded
      };
    } catch (error) {
      const jwtError = error as jwt.JsonWebTokenError;

      const validationError: ValidationError = {
        code: this.mapJWTErrorToCode(jwtError),
        message: jwtError.message
      };

      return {
        valid: false,
        expired: jwtError instanceof jwt.TokenExpiredError,
        errors: [validationError]
      };
    }
  }

  /**
   * Validates token type specific requirements
   */
  private validateTokenType(claims: TokenClaims, tokenType: 'access' | 'refresh' | 'id'): JWTValidationResult {
    const errors: ValidationError[] = [];

    switch (tokenType) {
      case 'access':
        if (!claims.scope && !claims.permissions) {
          errors.push({
            code: 'MISSING_ACCESS_CLAIMS',
            message: 'Access token must contain scope or permissions'
          });
        }
        break;

      case 'refresh':
        // Refresh tokens typically have longer expiration
        if (claims.exp && (claims.exp - claims.iat) < 86400) { // Less than 24 hours
          errors.push({
            code: 'INVALID_REFRESH_DURATION',
            message: 'Refresh token duration is too short'
          });
        }
        break;

      case 'id':
        if (!claims.sub) {
          errors.push({
            code: 'MISSING_SUBJECT',
            message: 'ID token must contain subject (sub) claim'
          });
        }
        break;
    }

    return {
      valid: errors.length === 0,
      expired: false,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Maps JWT library errors to our error codes
   */
  private mapJWTErrorToCode(error: jwt.JsonWebTokenError): string {
    if (error instanceof jwt.TokenExpiredError) {
      return 'TOKEN_EXPIRED';
    } else if (error instanceof jwt.JsonWebTokenError) {
      switch (error.message) {
        case 'invalid signature':
          return 'INVALID_SIGNATURE';
        case 'invalid token':
          return 'INVALID_TOKEN';
        case 'jwt malformed':
          return 'MALFORMED_JWT';
        case 'jwt audience invalid':
          return 'INVALID_AUDIENCE';
        case 'jwt issuer invalid':
          return 'INVALID_ISSUER';
        default:
          return 'JWT_ERROR';
      }
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Calculates remaining TTL for a token
   */
  private calculateRemainingTTL(claims: TokenClaims): number {
    if (!claims.exp) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, claims.exp - now);
  }

  /**
   * Generates a hash for token caching and revocation
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Retrieves cached validation result
   */
  private getCachedResult(token: string): JWTValidationResult | null {
    const tokenHash = this.hashToken(token);
    const cached = this.validationCache.get(tokenHash);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiry) {
      this.validationCache.delete(tokenHash);
      return null;
    }

    return cached.result;
  }

  /**
   * Caches validation result
   */
  private cacheResult(token: string, result: JWTValidationResult): void {
    const tokenHash = this.hashToken(token);
    const expiry = Date.now() + (this.config.cacheTTL * 1000);

    this.validationCache.set(tokenHash, { result, expiry });
  }

  /**
   * Cleans up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();

    for (const [key, cached] of this.validationCache.entries()) {
      if (now > cached.expiry) {
        this.validationCache.delete(key);
      }
    }
  }
}