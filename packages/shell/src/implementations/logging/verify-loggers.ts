/**
 * Simple verification script to test logger implementations
 * Run with: npx ts-node packages/shell/src/implementations/logging/verify-loggers.ts
 */

import { LogContext } from '@shell/interfaces';
import { ConsoleLogger } from './ConsoleLogger';
import { NoOpLogger, createTrackingNoOpLogger } from './NoOpLogger';

// Test context
const testContext: LogContext = {
  service: 'logger-verification',
  version: '1.0.0',
  environment: 'test',
  hostname: 'test-host',
  pid: process.pid,
};

console.log('🧪 Testing Logger Implementations\n');

// Test ConsoleLogger
console.log('📝 Testing ConsoleLogger:');
console.log('─'.repeat(40));

const consoleLogger = new ConsoleLogger(testContext, {
  level: 'debug',
  colorize: true,
  prettyPrint: true,
});

consoleLogger.info('ConsoleLogger: Info message');
consoleLogger.warn('ConsoleLogger: Warning message');
consoleLogger.error('ConsoleLogger: Error message', new Error('Test error'));

const consoleChild = consoleLogger.createChild({ service: 'child-service' });
consoleChild.debug('ConsoleLogger Child: Debug message');

console.log('\n');

// Test NoOpLogger (basic)
console.log('🔇 Testing NoOpLogger (Silent):');
console.log('─'.repeat(40));

const noOpLogger = new NoOpLogger(testContext);
noOpLogger.info('NoOpLogger: This should not appear');
noOpLogger.error('NoOpLogger: This error should not appear', new Error('Silent error'));

console.log('✅ NoOpLogger executed silently (no output expected)');
console.log('\n');

// Test NoOpLogger (tracking)
console.log('📊 Testing NoOpLogger (Tracking):');
console.log('─'.repeat(40));

const trackingLogger = createTrackingNoOpLogger(testContext);

trackingLogger.debug('Tracking: Debug message');
trackingLogger.info('Tracking: Info message');
trackingLogger.warn('Tracking: Warning message');
trackingLogger.error('Tracking: Error message', new Error('Tracked error'));

const stats = trackingLogger.getStats();
console.log('📈 Tracking Stats:');
console.log(`  Total calls: ${stats.totalCalls}`);
console.log(`  Debug: ${stats.debugCount}, Info: ${stats.infoCount}, Warn: ${stats.warnCount}, Error: ${stats.errorCount}`);
console.log(`  Last message: "${stats.lastCall?.message}"`);
console.log(`  Children created: ${stats.childrenCreated}`);

const trackingChild = trackingLogger.createChild({ service: 'tracking-child' });
trackingChild.info('Child message');

const updatedStats = trackingLogger.getStats();
console.log(`  Children created after child: ${updatedStats.childrenCreated}`);

console.log('\n');

// Test async flush
console.log('⚡ Testing Async Operations:');
console.log('─'.repeat(40));

Promise.all([
  consoleLogger.flush(),
  noOpLogger.flush(),
  trackingLogger.flush(),
]).then(() => {
  console.log('✅ All loggers flushed successfully');

  const flushStats = trackingLogger.getStats();
  console.log(`📈 Flush count: ${flushStats.flushCount}`);

  console.log('\n🎉 All logger implementations verified successfully!');

  // Test interface compliance
  console.log('\n🔍 Interface Compliance Check:');
  console.log('─'.repeat(40));

  const loggers = [
    { name: 'ConsoleLogger', logger: consoleLogger },
    { name: 'NoOpLogger', logger: noOpLogger },
    { name: 'TrackingLogger', logger: trackingLogger },
  ];

  loggers.forEach(({ name, logger }) => {
    const hasAllMethods = [
      'debug', 'info', 'warn', 'error',
      'setContext', 'createChild', 'flush'
    ].every(method => typeof logger[method as keyof typeof logger] === 'function');

    console.log(`  ${name}: ${hasAllMethods ? '✅' : '❌'} ILogger interface`);
  });

}).catch(error => {
  console.error('❌ Error during flush operations:', error);
});

// Test level filtering (ConsoleLogger)
console.log('🎚️ Testing Log Level Filtering:');
console.log('─'.repeat(40));

const warnLevelLogger = new ConsoleLogger(testContext, {
  level: 'warn',
  colorize: false,
  prettyPrint: false,
});

console.log('Logger set to WARN level - only warn/error should appear:');
warnLevelLogger.debug('This debug should NOT appear');
warnLevelLogger.info('This info should NOT appear');
warnLevelLogger.warn('This warning SHOULD appear');
warnLevelLogger.error('This error SHOULD appear');

console.log('\n✨ Verification complete! Check output above for logger behavior.');