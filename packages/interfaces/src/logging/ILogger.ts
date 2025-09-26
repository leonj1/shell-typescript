import { LogMetadata, LogContext } from './types';

export interface ILogger {
  debug(message: string, meta?: LogMetadata): void;
  info(message: string, meta?: LogMetadata): void;
  warn(message: string, meta?: LogMetadata): void;
  error(message: string, error?: Error, meta?: LogMetadata): void;
  setContext(context: LogContext): void;
  createChild(context: Partial<LogContext>): ILogger;
  flush(): Promise<void>;
}