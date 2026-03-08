import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/api/models/system_module_create_log_entry.dart';
import 'package:fastybird_smart_panel/api/models/system_module_create_log_entry_context.dart';
import 'package:fastybird_smart_panel/api/models/system_module_create_log_entry_source.dart';
import 'package:fastybird_smart_panel/api/models/system_module_create_log_entry_type.dart';
import 'package:fastybird_smart_panel/api/models/system_module_req_create_log_entries.dart';
import 'package:fastybird_smart_panel/api/system_module/system_module_client.dart';

/// Maximum number of entries per API call.
const int _maxBatch = 20;

/// How often the queue is flushed to the backend.
const Duration _flushInterval = Duration(seconds: 2);

/// Upper bound for the in-memory queue to prevent unbounded growth.
const int _maxQueueSize = 200;

/// Maximum length for a single log message (backend enforces 2000).
const int _maxMessageLength = 2000;

/// Maximum number of consecutive flush failures before giving up.
const int _maxConsecutiveFailures = 8;

/// Upper bound for the backoff delay.
const Duration _maxBackoff = Duration(seconds: 60);

/// Reports errors and exceptions to the backend log endpoint.
///
/// The reporter buffers entries in memory and flushes them in batches.
/// It is safe to call [reportFlutterError] and [reportError] before
/// the API client is available — entries are queued and sent once
/// [setApiClient] is called.
class ErrorReporter {
  static final ErrorReporter instance = ErrorReporter._();

  final List<SystemModuleCreateLogEntry> _queue = [];
  Timer? _timer;
  bool _flushing = false;
  int _consecutiveFailures = 0;

  SystemModuleClient? _apiClient;
  String? _appVersion;

  ErrorReporter._();

  /// Connect to the API client. Called after startup initialisation.
  void setApiClient(SystemModuleClient client) {
    _apiClient = client;
    _consecutiveFailures = 0;

    // Kick off a flush for anything that was buffered during startup.
    _scheduleFlush();
  }

  /// Cache the app version string shown in the log context.
  void setAppVersion(String version) {
    _appVersion = version;
  }

  /// Disconnect from the API client and cancel pending timers on teardown.
  void clearApiClient() {
    _apiClient = null;
    _timer?.cancel();
    _timer = null;
  }

  // ---------------------------------------------------------------------------
  // Public reporting API
  // ---------------------------------------------------------------------------

  /// Capture a Flutter framework error (called from [FlutterError.onError]).
  void reportFlutterError(FlutterErrorDetails details) {
    final args = <dynamic>[
      if (details.stack != null) details.stack.toString(),
      if (details.library != null) 'library: ${details.library}',
      if (details.context != null) 'context: ${details.context}',
    ];

    _enqueue(
      message: details.exceptionAsString(),
      type: SystemModuleCreateLogEntryType.error,
      level: 5,
      tag: 'flutter',
      args: args,
    );
  }

  /// Capture an uncaught platform/async error
  /// (called from [PlatformDispatcher.instance.onError]).
  void reportPlatformError(Object error, StackTrace stackTrace) {
    _enqueue(
      message: error.toString(),
      type: SystemModuleCreateLogEntryType.fatal,
      level: 6,
      tag: 'platform',
      args: [stackTrace.toString()],
    );
  }

  /// Report an error from application code (e.g. from [AppLogger.error]).
  void reportError(
    String message, {
    Object? error,
    StackTrace? stackTrace,
    String? tag,
  }) {
    _enqueue(
      message: message,
      type: SystemModuleCreateLogEntryType.error,
      level: 5,
      tag: tag,
      args: [
        if (error != null) error.toString(),
        if (stackTrace != null) stackTrace.toString(),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  void _enqueue({
    required String message,
    required SystemModuleCreateLogEntryType type,
    required int level,
    String? tag,
    List<dynamic>? args,
  }) {
    // Drop oldest entries when the queue is full.
    while (_queue.length >= _maxQueueSize) {
      _queue.removeAt(0);
    }

    final truncatedMessage =
        message.length > _maxMessageLength ? message.substring(0, _maxMessageLength) : message;

    final cleanArgs = args?.where((a) => a != null).toList();

    final entry = SystemModuleCreateLogEntry(
      ts: DateTime.now().toUtc(),
      source: SystemModuleCreateLogEntrySource.display,
      level: level,
      type: type,
      tag: tag,
      message: truncatedMessage,
      args: (cleanArgs != null && cleanArgs.isNotEmpty) ? cleanArgs : null,
      context: SystemModuleCreateLogEntryContext(
        appVersion: _appVersion,
        userAgent: '${Platform.operatingSystem}/${Platform.operatingSystemVersion}',
      ),
    );

    _queue.add(entry);

    if (_queue.length >= _maxBatch) {
      _timer?.cancel();
      _flush();
    } else {
      _scheduleFlush();
    }
  }

  void _scheduleFlush() {
    if (_timer != null && _timer!.isActive) return;

    // Stop retrying after too many consecutive failures.
    if (_consecutiveFailures >= _maxConsecutiveFailures) {
      if (kDebugMode) {
        debugPrint(
          '[ErrorReporter] Stopped retrying after $_consecutiveFailures consecutive failures',
        );
      }
      return;
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, … capped at 60s.
    final delay = _consecutiveFailures == 0
        ? _flushInterval
        : Duration(
            milliseconds: min(
              _flushInterval.inMilliseconds * pow(2, _consecutiveFailures).toInt(),
              _maxBackoff.inMilliseconds,
            ),
          );

    _timer = Timer(delay, _flush);
  }

  Future<void> _flush() async {
    _timer?.cancel();
    _timer = null;

    if (_flushing || _queue.isEmpty || _apiClient == null) return;

    _flushing = true;

    // Remove the batch from the queue before the async gap so that
    // concurrent _enqueue calls cannot shift indices under us.
    final count = min(_queue.length, _maxBatch);
    final batch = List<SystemModuleCreateLogEntry>.of(
      _queue.getRange(0, count),
    );
    _queue.removeRange(0, count);

    try {
      await _apiClient!.createSystemModuleLogs(
        body: SystemModuleReqCreateLogEntries(data: batch),
      );

      _consecutiveFailures = 0;
    } catch (e) {
      _consecutiveFailures++;

      // Re-insert at the front so the next flush retries them.
      _queue.insertAll(0, batch);

      // Cap the queue by trimming newest entries (tail) so the retry
      // batch at the front is not immediately evicted by _enqueue's
      // overflow protection which drops from position 0.
      if (_queue.length > _maxQueueSize) {
        _queue.removeRange(_maxQueueSize, _queue.length);
      }

      if (kDebugMode) {
        debugPrint(
          '[ErrorReporter] Failed to flush error log batch '
          '(attempt $_consecutiveFailures/$_maxConsecutiveFailures): $e',
        );
      }
    } finally {
      _flushing = false;

      if (_queue.isNotEmpty && _apiClient != null) {
        _scheduleFlush();
      }
    }
  }

}
