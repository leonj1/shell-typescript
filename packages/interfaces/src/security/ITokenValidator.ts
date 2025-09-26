/**
 * Interface for JWT token validation with comprehensive security features
 */
export interface ITokenValidator {
  /**
   * Validates an access token with comprehensive checks
   * @param token - The JWT access token to validate
   * @returns Promise resolving to validation result with claims and errors
   */
  validateAccessToken(token: string): Promise<JWTValidationResult>;

  /**
   * Validates a refresh token
   * @param token - The JWT refresh token to validate
   * @returns Promise resolving to validation result
   */
  validateRefreshToken(token: string): Promise<JWTValidationResult>;

  /**
   * Validates an ID token
   * @param token - The JWT ID token to validate
   * @returns Promise resolving to validation result
   */
  validateIdToken(token: string): Promise<JWTValidationResult>;

  /**
   * Verifies the cryptographic signature of a token
   * @param token - The JWT token to verify
   * @param publicKey - The public key to verify against
   * @returns Promise resolving to signature validity
   */
  verifySignature(token: string, publicKey: string): Promise<boolean>;

  /**
   * Checks if a token is expired
   * @param token - The JWT token to check
   * @returns True if token is expired, false otherwise
   */
  checkExpiration(token: string): boolean;

  /**
   * Extracts claims from a token without validation
   * @param token - The JWT token to parse
   * @returns Token claims object
   */
  extractClaims(token: string): TokenClaims;

  /**
   * Validates the audience claim of a token
   * @param token - The JWT token to validate
   * @param expectedAudience - The expected audience value
   * @returns True if audience is valid, false otherwise
   */
  validateAudience(token: string, expectedAudience: string): boolean;

  /**
   * Validates the issuer claim of a token
   * @param token - The JWT token to validate
   * @param expectedIssuer - The expected issuer value
   * @returns True if issuer is valid, false otherwise
   */
  validateIssuer(token: string, expectedIssuer: string): boolean;
}

/**
 * Result of token validation containing status, claims, and error details
 */
export interface JWTValidationResult {
  /** Whether the token is valid */
  valid: boolean;

  /** Whether the token is expired */
  expired: boolean;

  /** Token claims if validation succeeded */
  claims?: TokenClaims;

  /** Validation errors if validation failed */
  errors?: ValidationError[];

  /** Remaining time-to-live in seconds */
  remainingTTL?: number;
}

/**
 * JWT token claims structure
 */
export interface TokenClaims {
  /** Subject (user ID) */
  sub: string;

  /** Issuer */
  iss: string;

  /** Audience - can be string or array */
  aud: string | string[];

  /** Expiration time (Unix timestamp) */
  exp: number;

  /** Issued at time (Unix timestamp) */
  iat: number;

  /** Scope claim for access tokens */
  scope?: string;

  /** Permissions array */
  permissions?: string[];

  /** Roles array */
  roles?: string[];

  /** Additional custom claims */
  [key: string]: any;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Field that caused the error */
  field?: string;

  /** Additional error context */
  details?: Record<string, any>;
}