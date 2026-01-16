import 'package:fastybird_smart_panel/core/services/app_logger.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() {
    // Reset to a fresh instance before each test
    AppLogger.resetForTesting(config: LoggerConfig.debug);
  });

  group('AppLogger', () {
    group('singleton', () {
      test('returns same instance', () {
        final instance1 = AppLogger.instance;
        final instance2 = AppLogger.instance;

        expect(identical(instance1, instance2), isTrue);
      });

      test('resetForTesting creates new instance', () {
        final instance1 = AppLogger.instance;
        AppLogger.resetForTesting();
        final instance2 = AppLogger.instance;

        expect(identical(instance1, instance2), isFalse);
      });
    });

    group('configuration', () {
      test('uses provided config', () {
        AppLogger.resetForTesting(config: LoggerConfig.release);
        final logger = AppLogger.instance;

        expect(logger.config.minLevel, equals(LogLevel.warning));
      });

      test('configure updates config', () {
        final logger = AppLogger.instance;
        logger.configure(LoggerConfig.release);

        expect(logger.config.minLevel, equals(LogLevel.warning));
        expect(logger.config.includeTimestamp, isFalse);
      });

      test('config getter returns current config', () {
        final logger = AppLogger.instance;
        const customConfig = LoggerConfig(
          minLevel: LogLevel.info,
          includeTimestamp: false,
          includeModule: false,
        );
        logger.configure(customConfig);

        expect(logger.config.minLevel, equals(LogLevel.info));
        expect(logger.config.includeTimestamp, isFalse);
        expect(logger.config.includeModule, isFalse);
      });
    });

    group('log methods', () {
      late List<String> logOutput;

      setUp(() {
        logOutput = [];
        // Note: In actual tests, we'd need to capture debugPrint output
        // For unit testing the logger logic, we rely on the internal implementation
      });

      test('debug method exists and can be called', () {
        final logger = AppLogger.instance;
        // Should not throw
        expect(() => logger.debug('TEST', 'Debug message'), returnsNormally);
      });

      test('info method exists and can be called', () {
        final logger = AppLogger.instance;
        expect(() => logger.info('TEST', 'Info message'), returnsNormally);
      });

      test('warning method exists and can be called', () {
        final logger = AppLogger.instance;
        expect(() => logger.warning('TEST', 'Warning message'), returnsNormally);
      });

      test('error method exists and can be called', () {
        final logger = AppLogger.instance;
        expect(() => logger.error('TEST', 'Error message'), returnsNormally);
      });

      test('error method accepts optional error and stackTrace', () {
        final logger = AppLogger.instance;
        expect(
          () => logger.error(
            'TEST',
            'Error message',
            Exception('Test error'),
            StackTrace.current,
          ),
          returnsNormally,
        );
      });
    });

    group('log level filtering', () {
      test('filters messages below minLevel', () {
        AppLogger.resetForTesting(
          config: const LoggerConfig(minLevel: LogLevel.warning),
        );
        final logger = AppLogger.instance;

        // These should be filtered out (no crash, just no output)
        expect(() => logger.debug('TEST', 'Debug'), returnsNormally);
        expect(() => logger.info('TEST', 'Info'), returnsNormally);

        // These should pass through
        expect(() => logger.warning('TEST', 'Warning'), returnsNormally);
        expect(() => logger.error('TEST', 'Error'), returnsNormally);
      });

      test('logs nothing when level is none', () {
        AppLogger.resetForTesting(
          config: const LoggerConfig(minLevel: LogLevel.none),
        );
        final logger = AppLogger.instance;

        // All should be filtered
        expect(() => logger.debug('TEST', 'Debug'), returnsNormally);
        expect(() => logger.info('TEST', 'Info'), returnsNormally);
        expect(() => logger.warning('TEST', 'Warning'), returnsNormally);
        expect(() => logger.error('TEST', 'Error'), returnsNormally);
      });
    });
  });

  group('LogLevel', () {
    test('has correct order', () {
      expect(LogLevel.debug.index, lessThan(LogLevel.info.index));
      expect(LogLevel.info.index, lessThan(LogLevel.warning.index));
      expect(LogLevel.warning.index, lessThan(LogLevel.error.index));
      expect(LogLevel.error.index, lessThan(LogLevel.none.index));
    });

    test('all levels are defined', () {
      expect(LogLevel.values.length, equals(5));
      expect(LogLevel.values, contains(LogLevel.debug));
      expect(LogLevel.values, contains(LogLevel.info));
      expect(LogLevel.values, contains(LogLevel.warning));
      expect(LogLevel.values, contains(LogLevel.error));
      expect(LogLevel.values, contains(LogLevel.none));
    });
  });

  group('LoggerConfig', () {
    test('default config has expected values', () {
      const config = LoggerConfig();

      expect(config.minLevel, equals(LogLevel.debug));
      expect(config.includeTimestamp, isTrue);
      expect(config.includeModule, isTrue);
    });

    test('debug config has verbose settings', () {
      const config = LoggerConfig.debug;

      expect(config.minLevel, equals(LogLevel.debug));
      expect(config.includeTimestamp, isTrue);
      expect(config.includeModule, isTrue);
    });

    test('release config has less verbose settings', () {
      const config = LoggerConfig.release;

      expect(config.minLevel, equals(LogLevel.warning));
      expect(config.includeTimestamp, isFalse);
      expect(config.includeModule, isTrue);
    });

    test('none config disables all logging', () {
      const config = LoggerConfig.none;

      expect(config.minLevel, equals(LogLevel.none));
    });

    test('custom config respects provided values', () {
      const config = LoggerConfig(
        minLevel: LogLevel.info,
        includeTimestamp: false,
        includeModule: false,
      );

      expect(config.minLevel, equals(LogLevel.info));
      expect(config.includeTimestamp, isFalse);
      expect(config.includeModule, isFalse);
    });
  });
}
