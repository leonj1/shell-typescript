import { ITelemetryProvider, ISpan, SpanOptions, SpanStatus, EventProperties, ErrorProperties, UserProperties, GlobalProperties } from '@shell/interfaces';

export class DatadogTelemetryProvider implements ITelemetryProvider {
  private globalProperties: GlobalProperties = {};

  trackEvent(name: string, properties?: EventProperties): void {
    console.log(`Tracking event: ${name}`, properties);
  }

  trackMetric(name: string, value: number, unit?: string, tags?: any): void {
    console.log(`Tracking metric: ${name} = ${value}${unit ? ' ' + unit : ''}`, tags);
  }

  trackError(error: Error, properties?: ErrorProperties): void {
    console.log(`Tracking error: ${error.message}`, properties);
  }

  startSpan(name: string, options?: SpanOptions): ISpan {
    console.log(`Starting span: ${name}`, options);
    return new DatadogSpan(name);
  }

  setUser(userId: string, properties?: UserProperties): void {
    console.log(`Setting user: ${userId}`, properties);
  }

  setGlobalProperties(properties: GlobalProperties): void {
    this.globalProperties = { ...this.globalProperties, ...properties };
  }

  async flush(): Promise<void> {
    console.log('Flushing telemetry data...');
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down telemetry provider...');
  }
}

class DatadogSpan implements ISpan {
  private name: string;
  private ended: boolean = false;

  constructor(name: string) {
    this.name = name;
  }

  setTag(key: string, value: string | number | boolean): void {
    console.log(`Setting tag on span ${this.name}: ${key} = ${value}`);
  }

  setStatus(status: SpanStatus): void {
    console.log(`Setting status on span ${this.name}: ${status}`);
  }

  addEvent(name: string, properties?: Record<string, any>): void {
    console.log(`Adding event to span ${this.name}: ${name}`, properties);
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    console.log(`Ending span: ${this.name}`);
  }
}