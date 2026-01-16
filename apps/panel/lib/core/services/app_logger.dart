import 'package:flutter/foundation.dart';

/// Log level for filtering messages
enum LogLevel {
  /// Most detailed logs, for development debugging
  debug,

  /// Informational messages about normal operation
  info,

  /// Warning messages about potential issues
  warning,

  /// Error messages about failures
  error,

  /// No logging
  none,
}

/// Configuration for the app logger
class LoggerConfig {
  /// Minimum level to log (messages below this level are ignored)
  final LogLevel minLevel;

  /// Whether to include timestamps in log output
  final bool includeTimestamp;

  /// Whether to include the module name in log output
  final bool includeModule;

  const LoggerConfig({
    this.minLevel = LogLevel.debug,
    this.includeTimestamp = true,
    this.includeModule = true,
  });

  /// Default configuration for debug builds
  static const LoggerConfig debug = LoggerConfig(
    minLevel: LogLevel.debug,
    includeTimestamp: true,
    includeModule: true,
  );

  /// Default configuration for release builds (less verbose)
  static const LoggerConfig release = LoggerConfig(
    minLevel: LogLevel.warning,
    includeTimestamp: false,
    includeModule: true,
  );

  /// Configuration that disables all logging
  static const LoggerConfig none = LoggerConfig(
    minLevel: LogLevel.none,
  );
}

/// Centralized logging service with configurable log levels.
///
/// Provides structured logging with module prefixes and optional timestamps.
/// Can be configured differently for debug vs release builds.
///
/// Example usage:
/// ```dart
/// final logger = AppLogger.instance;
/// logger.debug('SPACES', 'Fetching lighting state for space-123');
/// logger.error('SPACES', 'API error: $error');
/// ```
class AppLogger {
  static AppLogger? _instance;
  LoggerConfig _config;

  AppLogger._({LoggerConfig? config})
      : _config = config ?? (kDebugMode ? LoggerConfig.debug : LoggerConfig.release);

  /// Singleton instance
  static AppLogger get instance {
    _instance ??= AppLogger._();
    return _instance!;
  }

  /// Reset the singleton instance (for testing only)
  @visibleForTesting
  static void resetForTesting({LoggerConfig? config}) {
    _instance = AppLogger._(config: config);
  }

  /// Update logger configuration
  void configure(LoggerConfig config) {
    _config = config;
  }

  /// Get current configuration
  LoggerConfig get config => _config;

  /// Log a debug message
  void debug(String module, String message) {
    _log(LogLevel.debug, module, message);
  }

  /// Log an info message
  void info(String module, String message) {
    _log(LogLevel.info, module, message);
  }

  /// Log a warning message
  void warning(String module, String message) {
    _log(LogLevel.warning, module, message);
  }

  /// Log an error message
  void error(String module, String message, [Object? error, StackTrace? stackTrace]) {
    _log(LogLevel.error, module, message);
    if (error != null && kDebugMode) {
      debugPrint('  Error: $error');
      if (stackTrace != null) {
        debugPrint('  Stack: $stackTrace');
      }
    }
  }

  void _log(LogLevel level, String module, String message) {
    if (level.index < _config.minLevel.index) {
      return;
    }

    if (!kDebugMode && level.index < LogLevel.warning.index) {
      return;
    }

    final buffer = StringBuffer();

    if (_config.includeTimestamp) {
      final now = DateTime.now();
      buffer.write('[${now.hour.toString().padLeft(2, '0')}:');
      buffer.write('${now.minute.toString().padLeft(2, '0')}:');
      buffer.write('${now.second.toString().padLeft(2, '0')}] ');
    }

    buffer.write('[${_levelPrefix(level)}]');

    if (_config.includeModule) {
      buffer.write('[$module]');
    }

    buffer.write(' $message');

    debugPrint(buffer.toString());
  }

  String _levelPrefix(LogLevel level) {
    switch (level) {
      case LogLevel.debug:
        return 'DEBUG';
      case LogLevel.info:
        return 'INFO';
      case LogLevel.warning:
        return 'WARN';
      case LogLevel.error:
        return 'ERROR';
      case LogLevel.none:
        return '';
    }
  }
}
