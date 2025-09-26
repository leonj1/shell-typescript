export interface IAuthorizationService {
  hasPermission(permission: string | Permission): Promise<boolean>;
  hasRole(role: string | Role): Promise<boolean>;
  canAccess(resource: string, action: string, context?: AccessContext): Promise<boolean>;
  getUserPermissions(): Promise<Permission[]>;
  getUserRoles(): Promise<Role[]>;
  checkPolicy(policyName: string, context?: PolicyContext): Promise<boolean>;
  evaluateRule(rule: AuthorizationRule, context?: RuleContext): Promise<boolean>;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  actions: string[];
  conditions?: any[];
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  inheritedFrom?: Role[];
}

export interface AccessContext {
  userId: string;
  resource: string;
  action: string;
  environment: string;
  requestMetadata?: Record<string, any>;
}

export interface PolicyContext {
  user: any;
  resource: string;
  action: string;
  environment: string;
  [key: string]: any;
}

export interface AuthorizationRule {
  id: string;
  name: string;
  condition: (context: RuleContext) => Promise<boolean>;
  permissions: string[];
}

export interface RuleContext {
  user: any;
  resource: string;
  action: string;
  [key: string]: any;
}

