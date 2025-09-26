import { ILogger, LogContext } from '@shell/interfaces';
import { ConsoleLogger } from '../ConsoleLogger';
import { NoOpLogger, createTrackingNoOpLogger, createSilentNoOpLogger } from '../NoOpLogger';

describe('Logger Implementations', () => {
  const testContext: LogContext = {
    service: 'test-service',
    version: '1.0.0',
    environment: 'test',
    hostname: 'test-host',
    pid: 12345,
  };

  describe('ConsoleLogger', () => {
    let logger: ConsoleLogger;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      logger = new ConsoleLogger(testContext, { colorize: false }); // Disable colors for testing
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'debug').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should implement ILogger interface', () => {
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.setContext).toBeDefined();
      expect(logger.createChild).toBeDefined();
      expect(logger.flush).toBeDefined();
    });

    it('should log messages at different levels', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should create child loggers', () => {
      const child = logger.createChild({ service: 'child-service' });
      expect(child).toBeInstanceOf(ConsoleLogger);
      expect(child).not.toBe(logger);
    });

    it('should set context', () => {
      const newContext: LogContext = {
        ...testContext,
        service: 'updated-service',
      };

      logger.setContext(newContext);
      logger.info('Test message');

      // Should not throw and should call console.log
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle flush', async () => {
      await expect(logger.flush()).resolves.not.toThrow();
    });

    it('should handle errors properly', () => {
      const testError = new Error('Test error');
      logger.error('Error occurred', testError);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should respect log levels', () => {
      const warnLogger = new ConsoleLogger(testContext, { level: 'warn', colorize: false });

      warnLogger.debug('Should not appear');
      warnLogger.info('Should not appear');
      warnLogger.warn('Should appear');
      warnLogger.error('Should appear');

      // Debug and info should not be called due to level filtering
      expect(consoleSpy).toHaveBeenCalledTimes(2); // Only warn and error
    });

    it('should handle metadata', () => {
      logger.info('Test message', {
        timestamp: new Date(),
        severity: 'info',
        source: 'test',
        correlationId: '123',
        tags: ['test'],
      });

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('NoOpLogger', () => {
    describe('Basic NoOpLogger', () => {
      let logger: NoOpLogger;

      beforeEach(() => {
        logger = new NoOpLogger(testContext);
      });

      it('should implement ILogger interface', () => {
        expect(logger.debug).toBeDefined();
        expect(logger.info).toBeDefined();
        expect(logger.warn).toBeDefined();
        expect(logger.error).toBeDefined();
        expect(logger.setContext).toBeDefined();
        expect(logger.createChild).toBeDefined();
        expect(logger.flush).toBeDefined();
      });

      it('should perform no-op logging', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');

        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should create child loggers', () => {
        const child = logger.createChild({ service: 'child-service' });
        expect(child).toBeInstanceOf(NoOpLogger);
        expect(child).not.toBe(logger);
      });

      it('should handle flush', async () => {
        await expect(logger.flush()).resolves.not.toThrow();
      });

      it('should set context without issues', () => {
        expect(() => {
          logger.setContext({ ...testContext, service: 'updated-service' });
        }).not.toThrow();
      });
    });

    describe('Tracking NoOpLogger', () => {
      let logger: NoOpLogger;

      beforeEach(() => {
        logger = createTrackingNoOpLogger(testContext);
      });

      it('should track log calls', () => {
        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');

        const stats = logger.getStats();
        expect(stats.debugCount).toBe(1);
        expect(stats.infoCount).toBe(1);
        expect(stats.warnCount).toBe(1);
        expect(stats.errorCount).toBe(1);
        expect(stats.totalCalls).toBe(4);
      });

      it('should track last call', () => {
        const testMessage = 'Test message';
        logger.info(testMessage, { correlationId: '123' });

        const stats = logger.getStats();
        expect(stats.lastCall?.method).toBe('info');
        expect(stats.lastCall?.message).toBe(testMessage);
        expect(stats.lastCall?.meta?.correlationId).toBe('123');
      });

      it('should track errors', () => {
        const testError = new Error('Test error');
        logger.error('Error occurred', testError);

        const stats = logger.getStats();
        expect(stats.lastCall?.error).toBe(testError);
      });

      it('should track context changes', () => {
        logger.setContext({ ...testContext, service: 'updated' });

        const stats = logger.getStats();
        expect(stats.contextChanges).toBe(1);
      });

      it('should track child creation', () => {
        logger.createChild({ service: 'child' });

        const stats = logger.getStats();
        expect(stats.childrenCreated).toBe(1);
      });

      it('should track flush calls', async () => {
        await logger.flush();

        const stats = logger.getStats();
        expect(stats.flushCount).toBe(1);
      });

      it('should reset stats', () => {
        logger.info('Test');
        expect(logger.getStats().totalCalls).toBe(1);

        logger.resetStats();
        expect(logger.getStats().totalCalls).toBe(0);
      });

      it('should provide utility methods', () => {
        logger.info('Test');

        expect(logger.getTotalCalls()).toBe(1);
        expect(logger.getCallCount('info')).toBe(1);
        expect(logger.getCallCount('debug')).toBe(0);
        expect(logger.getLastMessage()).toBe('Test');
        expect(logger.hasMessage('Test')).toBe(true);
        expect(logger.wasCalled()).toBe(true);
        expect(logger.wasLevelCalled('info')).toBe(true);
        expect(logger.wasLevelCalled('debug')).toBe(false);
      });
    });

    describe('Silent NoOpLogger', () => {
      let logger: NoOpLogger;

      beforeEach(() => {
        logger = createSilentNoOpLogger(testContext);
      });

      it('should not track calls for maximum performance', () => {
        logger.info('Test message');

        const stats = logger.getStats();
        expect(stats.totalCalls).toBe(0);
        expect(logger.isTrackingEnabled()).toBe(false);
      });

      it('should enable tracking dynamically', () => {
        logger.info('Test 1'); // Not tracked

        logger.setTracking(true);
        logger.info('Test 2'); // Tracked

        const stats = logger.getStats();
        expect(stats.totalCalls).toBe(1); // Only the second call
      });
    });
  });

  describe('Logger Interface Compliance', () => {
    const loggers: Array<{ name: string; logger: ILogger }> = [
      { name: 'ConsoleLogger', logger: new ConsoleLogger(testContext, { colorize: false }) },
      { name: 'NoOpLogger', logger: new NoOpLogger(testContext) },
      { name: 'TrackingNoOpLogger', logger: createTrackingNoOpLogger(testContext) },
    ];

    loggers.forEach(({ name, logger }) => {
      describe(`${name} Interface Compliance`, () => {
        it('should have all required ILogger methods', () => {
          expect(typeof logger.debug).toBe('function');
          expect(typeof logger.info).toBe('function');
          expect(typeof logger.warn).toBe('function');
          expect(typeof logger.error).toBe('function');
          expect(typeof logger.setContext).toBe('function');
          expect(typeof logger.createChild).toBe('function');
          expect(typeof logger.flush).toBe('function');
        });

        it('should handle all method calls without throwing', () => {
          expect(() => {
            logger.debug('Debug message');
            logger.info('Info message');
            logger.warn('Warning message');
            logger.error('Error message', new Error('Test error'));
            logger.setContext(testContext);
            logger.createChild({ service: 'child' });
          }).not.toThrow();
        });

        it('should handle flush as async operation', async () => {
          await expect(logger.flush()).resolves.not.toThrow();
        });

        it('should create child loggers that implement ILogger', () => {
          const child = logger.createChild({ service: 'child-service' });

          expect(typeof child.debug).toBe('function');
          expect(typeof child.info).toBe('function');
          expect(typeof child.warn).toBe('function');
          expect(typeof child.error).toBe('function');
          expect(typeof child.setContext).toBe('function');
          expect(typeof child.createChild).toBe('function');
          expect(typeof child.flush).toBe('function');
        });
      });
    });
  });
});