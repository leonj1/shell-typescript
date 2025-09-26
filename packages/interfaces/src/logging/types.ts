export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogFormat = 'json' | 'text' | 'structured' | 'ecs';
export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface LogMetadata {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  timestamp: Date;
  severity: LogLevel;
  source: string;
  tags?: string[];
  [key: string]: any;
}

export interface LogContext {
  service: string;
  version: string;
  environment: Environment;
  hostname: string;
  pid: number;
  deployment?: DeploymentInfo;
}

export interface DeploymentInfo {
  id: string;
  version: string;
  commitHash?: string;
  buildNumber?: string;
  deployedAt: Date;
  deployedBy?: string;
}

export interface LogDestination {
  type: 'console' | 'file' | 'http' | 'syslog' | 'datadog';
  config: DestinationConfig;
  filter?: LogFilter;
  formatter?: LogFormatter;
}

export interface DestinationConfig {
  [key: string]: any;
}

export interface LogFilter {
  minLevel?: LogLevel;
  maxLevel?: LogLevel;
  includeServices?: string[];
  excludeServices?: string[];
  includeTags?: string[];
  excludeTags?: string[];
}

export interface LogFormatter {
  format: LogFormat;
  includeTimestamp?: boolean;
  includeLevel?: boolean;
  includeSource?: boolean;
  timestampFormat?: string;
  colorize?: boolean;
  prettyPrint?: boolean;
}

export interface StructuredLogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: LogMetadata;
  context?: LogContext;
  error?: SerializedError;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  [key: string]: any;
}

// Transport specific configurations
export interface FileDestinationConfig extends DestinationConfig {
  filename: string;
  maxSize?: number;
  maxFiles?: number;
  datePattern?: string;
  createSymlink?: boolean;
}

export interface HttpDestinationConfig extends DestinationConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  batchSize?: number;
  flushInterval?: number;
}

export interface DatadogDestinationConfig extends DestinationConfig {
  apiKey: string;
  service: string;
  source?: string;
  tags?: string[];
  hostname?: string;
}

export interface SyslogDestinationConfig extends DestinationConfig {
  host: string;
  port?: number;
  protocol?: 'tcp' | 'udp';
  facility?: number;
  appName?: string;
}