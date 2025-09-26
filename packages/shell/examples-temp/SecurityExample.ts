/**
 * Example usage of the security implementations
 *
 * This example demonstrates how to configure and use:
 * - JWT Token Validation
 * - Content Security Policy Management
 * - Input Sanitization
 */

import {
  JWTTokenValidator,
  CSPManager,
  SanitizationService,
  JWTValidatorConfig,
  CSPManagerConfig,
  SanitizationServiceConfig
} from '../implementations/security';

/**
 * Example: Setting up JWT Token Validation
 */
export async function setupJWTValidation() {
  // Configuration for JWT validation
  const jwtConfig: JWTValidatorConfig = {
    secretOrPublicKey: process.env.JWT_PUBLIC_KEY || 'your-secret-key',
    algorithm: 'RS256',
    issuer: 'https://your-auth-provider.com',
    audience: 'your-app-audience',
    clockTolerance: 300, // 5 minutes
    cacheTTL: 300, // 5 minutes cache
    enableCaching: true
  };

  const tokenValidator = new JWTTokenValidator(jwtConfig);

  // Example: Validating an access token
  const accessToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';

  try {
    const result = await tokenValidator.validateAccessToken(accessToken);

    if (result.valid) {
      console.log('Token is valid!');
      console.log('User ID:', result.claims?.sub);
      console.log('Permissions:', result.claims?.permissions);
      console.log('Remaining TTL:', result.remainingTTL, 'seconds');
    } else {
      console.log('Token validation failed:', result.errors);
    }
  } catch (error) {
    console.error('Token validation error:', error);
  }

  // Example: Checking token expiration without full validation
  const isExpired = tokenValidator.checkExpiration(accessToken);
  console.log('Token expired:', isExpired);

  // Example: Extracting claims without validation
  try {
    const claims = tokenValidator.extractClaims(accessToken);
    console.log('Token claims:', claims);
  } catch (error) {
    console.error('Failed to extract claims:', error);
  }
}

/**
 * Example: Setting up Content Security Policy
 */
export function setupCSP() {
  // Configuration for CSP Manager
  const cspConfig: CSPManagerConfig = {
    environment: 'production',
    useStrictDynamic: true,
    enableViolationReporting: true,
    reportEndpoint: '/api/csp-report'
  };

  const cspManager = new CSPManager(cspConfig);

  // Generate a nonce for inline scripts
  const nonce = cspManager.getNonce();
  console.log('Generated nonce:', nonce);

  // Create a secure CSP policy
  const policy = cspManager.generatePolicy({
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    styleSrc: ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://api.example.com'],
    fontSrc: ["'self'", 'https://fonts.googleapis.com'],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    upgradeInsecureRequests: true,
    reportUri: '/api/csp-report'
  });

  console.log('CSP Policy:', policy);

  // Validate the policy
  const validation = cspManager.validatePolicy(policy);
  if (!validation.valid) {
    console.error('CSP Policy validation errors:', validation.errors);
  }
  if (validation.warnings) {
    console.warn('CSP Policy warnings:', validation.warnings);
  }

  // Set up violation reporting
  const unsubscribe = cspManager.onViolation((violation) => {
    console.error('CSP Violation detected:', {
      violatedDirective: violation.violatedDirective,
      blockedUri: violation.blockedUri,
      documentUri: violation.documentUri,
      timestamp: violation.timestamp
    });

    // Send to monitoring service
    // sendToMonitoring('csp-violation', violation);
  });

  // Example CSP header usage in Express
  /*
  app.use((req, res, next) => {
    const nonce = cspManager.getNonce();
    res.locals.nonce = nonce;

    const policy = cspManager.generatePolicy({
      // ... policy options with nonce
      scriptSrc: ["'self'", `'nonce-${nonce}'`]
    });

    res.setHeader('Content-Security-Policy', policy);
    next();
  });
  */

  return { cspManager, unsubscribe };
}

/**
 * Example: Setting up Input Sanitization
 */
export function setupSanitization() {
  // Configuration for Sanitization Service
  const sanitizationConfig: SanitizationServiceConfig = {
    maxInputLength: 1000000, // 1MB
    enableLogging: true,
    defaultHTMLOptions: {
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 'a'],
      allowedAttributes: {
        'a': ['href', 'title'],
        '*': ['class']
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      stripScripts: true,
      stripStyles: true,
      maxLength: 10000
    },
    defaultURLOptions: {
      allowedProtocols: ['http', 'https'],
      allowRelative: true,
      allowLocalhost: false,
      allowIPAddresses: false,
      blockedDomains: ['malicious.com', 'phishing.net']
    }
  };

  const sanitizer = new SanitizationService(sanitizationConfig);

  // Example: HTML Sanitization
  const userInput = '<script>alert("XSS")</script><p>Hello <strong>World</strong>!</p>';
  const sanitizedHTML = sanitizer.sanitizeHTML(userInput);
  console.log('Original HTML:', userInput);
  console.log('Sanitized HTML:', sanitizedHTML);

  // Example: SQL Sanitization
  const sqlInput = "'; DROP TABLE users; --";
  const sanitizedSQL = sanitizer.sanitizeSQL(sqlInput);
  console.log('Original SQL:', sqlInput);
  console.log('Sanitized SQL:', sanitizedSQL);

  // Example: JSON Sanitization
  const jsonInput = {
    name: '<script>alert("xss")</script>John Doe',
    email: 'john@example.com',
    __proto__: { admin: true }, // Dangerous property
    description: 'A regular user with <em>emphasis</em>'
  };
  const sanitizedJSON = sanitizer.sanitizeJSON(jsonInput);
  console.log('Original JSON:', jsonInput);
  console.log('Sanitized JSON:', sanitizedJSON);

  // Example: Filename Sanitization
  const filename = '../../../etc/passwd';
  const sanitizedFilename = sanitizer.sanitizeFilename(filename);
  console.log('Original filename:', filename);
  console.log('Sanitized filename:', sanitizedFilename);

  // Example: URL Sanitization
  const url = 'javascript:alert("XSS")';
  const sanitizedURL = sanitizer.sanitizeURL(url);
  console.log('Original URL:', url);
  console.log('Sanitized URL:', sanitizedURL);

  // Example: Email Validation
  const emails = ['user@example.com', 'invalid-email', 'test@domain'];
  emails.forEach(email => {
    const isValid = sanitizer.validateEmail(email);
    console.log(`Email "${email}" is valid:`, isValid);
  });

  // Example: Phone Number Validation
  const phoneNumbers = ['+1-555-123-4567', '555-123-4567', 'not-a-phone'];
  phoneNumbers.forEach(phone => {
    const isValid = sanitizer.validatePhoneNumber(phone, 'US');
    console.log(`Phone "${phone}" is valid:`, isValid);
  });

  // Example: Bulk Sanitization
  const htmlInputs = [
    '<script>alert(1)</script>Hello',
    '<p>Safe content</p>',
    '<img src="x" onerror="alert(2)">'
  ];
  const sanitizedBulk = sanitizer.sanitizeBulk(htmlInputs, 'html');
  console.log('Bulk sanitization results:', sanitizedBulk);

  // Example: Detailed Sanitization Result
  const detailedResult = sanitizer.sanitizeWithResult(
    '<script>evil()</script><p>Good content</p>',
    'html'
  );
  console.log('Detailed sanitization result:', {
    sanitized: detailedResult.sanitized,
    modified: detailedResult.modified,
    modifications: detailedResult.modifications,
    warnings: detailedResult.warnings
  });

  // Get sanitization statistics
  console.log('Sanitization stats:', sanitizer.getStats());

  return sanitizer;
}

/**
 * Example: Complete Security Setup
 */
export async function setupCompleteSecurity() {
  console.log('🔐 Setting up complete security framework...');

  // Setup JWT validation
  console.log('📝 Configuring JWT validation...');
  await setupJWTValidation();

  // Setup CSP
  console.log('🛡️ Configuring Content Security Policy...');
  const { cspManager } = setupCSP();

  // Setup input sanitization
  console.log('🧹 Configuring input sanitization...');
  const sanitizer = setupSanitization();

  console.log('✅ Security framework setup complete!');

  return {
    cspManager,
    sanitizer
  };
}

/**
 * Example: Express.js middleware integration
 */
export function createSecurityMiddleware() {
  const cspManager = new CSPManager({
    environment: 'production',
    enableViolationReporting: true
  });

  const sanitizer = new SanitizationService();

  const tokenValidator = new JWTTokenValidator({
    secretOrPublicKey: process.env.JWT_PUBLIC_KEY!,
    algorithm: 'RS256'
  });

  return {
    // CSP Middleware
    csp: (req: any, res: any, next: any) => {
      const nonce = cspManager.getNonce();
      res.locals.nonce = nonce;

      const policy = cspManager.generatePolicy({
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", `'nonce-${nonce}'`],
        styleSrc: ["'self'", `'nonce-${nonce}'`],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      });

      res.setHeader('Content-Security-Policy', policy);
      next();
    },

    // Input sanitization middleware
    sanitize: (req: any, res: any, next: any) => {
      if (req.body) {
        req.body = sanitizer.sanitizeJSON(req.body);
      }

      if (req.query) {
        Object.keys(req.query).forEach(key => {
          if (typeof req.query[key] === 'string') {
            req.query[key] = sanitizer.sanitizeHTML(req.query[key]);
          }
        });
      }

      next();
    },

    // JWT validation middleware
    validateToken: async (req: any, res: any, next: any) => {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      try {
        const result = await tokenValidator.validateAccessToken(token);

        if (!result.valid) {
          return res.status(401).json({
            error: 'Invalid token',
            details: result.errors
          });
        }

        req.user = result.claims;
        next();
      } catch (error) {
        return res.status(500).json({ error: 'Token validation failed' });
      }
    }
  };
}

// Example usage
if (require.main === module) {
  setupCompleteSecurity().catch(console.error);
}