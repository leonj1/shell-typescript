export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export type TagValue = string | number | boolean;

export interface ISpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;

  setTag(key: string, value: TagValue): void;
  addEvent(name: string, attributes?: SpanAttributes): void;
  setStatus(status: SpanStatus): void;
  recordException(error: Error, attributes?: SpanAttributes): void;
  end(): void;

  createChild(name: string): ISpan;
  getBaggage(): Map<string, string>;
  setBaggage(key: string, value: string): void;
}

export interface SpanOptions {
  parent?: ISpan;
  attributes?: SpanAttributes;
  links?: SpanLink[];
  startTime?: Date;
  kind?: SpanKind;
}

export type SpanStatus =
  | { code: 'OK' }
  | { code: 'ERROR'; message?: string }
  | { code: 'UNSET' };

export interface SpanAttributes {
  [key: string]: TagValue | TagValue[];
}

export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes?: SpanAttributes;
}

// Telemetry event types
export interface EventProperties {
  [key: string]: any;
  measurements?: Record<string, number>;
}

export interface ErrorProperties {
  type?: string;
  errorId?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

export interface UserProperties {
  id?: string;
  email?: string;
  role?: string;
  plan?: string;
  [key: string]: any;
}

export interface GlobalProperties {
  version?: string;
  environment?: string;
  deployment?: string;
  region?: string;
  [key: string]: any;
}

export interface Tags {
  [key: string]: TagValue;
}

// Metric types
export interface MetricValue {
  value: number;
  timestamp?: Date;
  tags?: Tags;
}

export interface CounterMetric extends MetricValue {
  name: string;
  type: 'counter';
}

export interface GaugeMetric extends MetricValue {
  name: string;
  type: 'gauge';
}

export interface HistogramMetric {
  name: string;
  type: 'histogram';
  values: number[];
  timestamp?: Date;
  tags?: Tags;
}

export interface TimerMetric {
  name: string;
  type: 'timer';
  duration: number;
  timestamp?: Date;
  tags?: Tags;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric | TimerMetric;

// Telemetry configuration
export interface TelemetryConfig {
  serviceName: string;
  version: string;
  environment: string;
  sampling?: SamplingConfig;
  exporters?: ExporterConfig[];
  processors?: ProcessorConfig[];
  resource?: ResourceAttributes;
}

export interface SamplingConfig {
  type: 'always' | 'never' | 'ratio' | 'rate';
  value?: number;
  rules?: SamplingRule[];
}

export interface SamplingRule {
  service?: string;
  operation?: string;
  rate: number;
}

export interface ExporterConfig {
  type: 'console' | 'otlp' | 'jaeger' | 'zipkin' | 'datadog' | 'applicationinsights';
  endpoint?: string;
  headers?: Record<string, string>;
  compression?: 'gzip' | 'none';
  timeout?: number;
  batchSize?: number;
  exportInterval?: number;
}

export interface ProcessorConfig {
  type: 'batch' | 'simple';
  maxBatchSize?: number;
  scheduledDelay?: number;
  exportTimeout?: number;
  maxExportBatchSize?: number;
}

export interface ResourceAttributes {
  'service.name': string;
  'service.version': string;
  'service.instance.id'?: string;
  'deployment.environment'?: string;
  'host.name'?: string;
  'host.type'?: string;
  'cloud.provider'?: string;
  'cloud.region'?: string;
  [key: string]: string | undefined;
}

// Performance monitoring
export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
}

export interface NavigationTimingEntry extends PerformanceEntry {
  unloadEventStart: number;
  unloadEventEnd: number;
  redirectStart: number;
  redirectEnd: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domLoading: number;
  domInteractive: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  domComplete: number;
  loadEventStart: number;
  loadEventEnd: number;
}

export interface ResourceTimingEntry extends PerformanceEntry {
  initiatorType: string;
  nextHopProtocol: string;
  renderBlockingStatus: string;
  responseStatus: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

// Custom events
export interface BusinessEvent {
  name: string;
  properties: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface SystemEvent {
  name: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

// Trace context
export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
  baggage?: Map<string, string>;
}

// Distributed tracing
export interface DistributedTraceHeaders {
  'traceparent'?: string;
  'tracestate'?: string;
  'baggage'?: string;
}

// Telemetry data aggregation
export interface MetricsSnapshot {
  timestamp: Date;
  metrics: Metric[];
  system: SystemMetrics;
}

export interface SystemMetrics {
  cpu: {
    usage: NodeJS.CpuUsage;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    heapUsed: number;
    heapTotal: number;
  };
  uptime: number;
  pid: number;
}

// Health monitoring
export interface HealthMetrics {
  responseTime: number;
  errorRate: number;
  throughput: number;
  availability: number;
  timestamp: Date;
}

// Custom telemetry providers
export interface TelemetryProviderFactory {
  create(config: TelemetryConfig): ITelemetryProvider;
  supports(type: string): boolean;
}

// For backward compatibility
export interface ITelemetryProvider {
  trackEvent(name: string, properties?: EventProperties): void;
  trackMetric(name: string, value: number, unit?: string, tags?: Tags): void;
  trackError(error: Error, properties?: ErrorProperties): void;
  startSpan(name: string, options?: SpanOptions): ISpan;
  setUser(userId: string, properties?: UserProperties): void;
  setGlobalProperties(properties: GlobalProperties): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;

  // Additional methods from the specification
  trackCounter(name: string, value?: number, tags?: Tags): void;
  trackGauge(name: string, value: number, tags?: Tags): void;
  trackHistogram(name: string, value: number, tags?: Tags): void;
  trackTiming(name: string, duration: number, tags?: Tags): void;

  // Performance monitoring
  trackNavigation(timing: NavigationTimingEntry): void;
  trackResource(timing: ResourceTimingEntry): void;

  // Business events
  trackBusinessEvent(event: BusinessEvent): void;
  trackSystemEvent(event: SystemEvent): void;

  // Trace context management
  getTraceContext(): TraceContext | null;
  setTraceContext(context: TraceContext): void;
  extractTraceHeaders(headers: Record<string, string>): DistributedTraceHeaders;
  injectTraceHeaders(): DistributedTraceHeaders;

  // Health monitoring
  trackHealth(metrics: HealthMetrics): void;

  // Configuration management
  updateConfig(config: Partial<TelemetryConfig>): void;
  getConfig(): TelemetryConfig;
}