import { ILogger, LogMetadata, LogContext } from '@shell/interfaces';

export class WinstonLogger implements ILogger {
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = context;
  }

  debug(message: string, meta?: LogMetadata): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: LogMetadata): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: LogMetadata): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: LogMetadata): void {
    this.log('error', message, meta, error);
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  createChild(context: Partial<LogContext>): ILogger {
    const childContext = { ...this.context, ...context };
    return new WinstonLogger(childContext);
  }

  async flush(): Promise<void> {
    // In a real implementation, this would flush any buffered logs
    console.log('Flushing logs...');
  }

  private log(level: string, message: string, meta?: LogMetadata, error?: Error): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context: this.context,
      meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    console.log(JSON.stringify(logEntry));
  }
}