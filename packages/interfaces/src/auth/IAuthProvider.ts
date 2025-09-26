export interface IAuthProvider {
  login(credentials: LoginCredentials): Promise<AuthResult>;
  logout(): Promise<void>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  getCurrentUser(): Promise<User | null>;
  isAuthenticated(): Promise<boolean>;
  getAccessToken(): Promise<string | null>;
  onAuthStateChange(callback: AuthStateChangeCallback): () => void;
  validateToken(token: string): Promise<TokenValidationResult>;
}

export interface LoginCredentials {
  email?: string;
  username?: string;
  password?: string;
  provider?: string;
  redirectUri?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  tokens?: TokenSet;
  error?: AuthError;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  metadata: Record<string, any>;
}

export type AuthStateChangeCallback = (user: User | null) => void;

export interface AuthError {
  code: string;
  message: string;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: any;
  error?: string;
}