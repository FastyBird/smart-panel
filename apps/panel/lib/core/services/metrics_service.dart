import 'package:flutter/foundation.dart';

/// Category of metric being tracked
enum MetricCategory {
  /// Intent execution (lighting, climate)
  intent,

  /// API calls and retries
  api,

  /// WebSocket events
  websocket,

  /// State operations
  state,
}

/// Result status of an operation
enum MetricStatus {
  success,
  failure,
  partial,
}

/// A single metric event
class MetricEvent {
  final MetricCategory category;
  final String name;
  final MetricStatus status;
  final Duration? duration;
  final Map<String, dynamic> metadata;
  final DateTime timestamp;

  MetricEvent({
    required this.category,
    required this.name,
    required this.status,
    this.duration,
    Map<String, dynamic>? metadata,
  })  : metadata = metadata ?? {},
        timestamp = DateTime.now();

  Map<String, dynamic> toJson() => {
        'category': category.name,
        'name': name,
        'status': status.name,
        'duration_ms': duration?.inMilliseconds,
        'metadata': metadata,
        'timestamp': timestamp.toIso8601String(),
      };
}

/// Aggregated metrics for a time period
class MetricsSummary {
  final int totalEvents;
  final int successCount;
  final int failureCount;
  final Duration? averageDuration;
  final Duration? maxDuration;
  final Duration? minDuration;

  MetricsSummary({
    required this.totalEvents,
    required this.successCount,
    required this.failureCount,
    this.averageDuration,
    this.maxDuration,
    this.minDuration,
  });

  double get successRate => totalEvents > 0 ? successCount / totalEvents : 0.0;
}

/// Service for tracking performance metrics and analytics.
///
/// Provides:
/// - Intent execution timing and success rates
/// - API retry tracking
/// - WebSocket event statistics
///
/// Example usage:
/// ```dart
/// final metrics = MetricsService.instance;
///
/// // Track an intent execution
/// final stopwatch = Stopwatch()..start();
/// try {
///   await executeLightingIntent(...);
///   metrics.trackIntent('lighting_off', MetricStatus.success, stopwatch.elapsed);
/// } catch (e) {
///   metrics.trackIntent('lighting_off', MetricStatus.failure, stopwatch.elapsed);
/// }
///
/// // Track a retry
/// metrics.trackRetry('/api/spaces/123/lighting', 1, 'connection_timeout');
///
/// // Get summary
/// final summary = metrics.getIntentSummary();
/// print('Success rate: ${summary.successRate}');
/// ```
class MetricsService {
  static MetricsService? _instance;

  final List<MetricEvent> _events = [];
  final int _maxEvents;
  bool _enabled;

  MetricsService._({
    int maxEvents = 1000,
    bool enabled = true,
  })  : _maxEvents = maxEvents,
        _enabled = enabled;

  /// Singleton instance
  static MetricsService get instance {
    _instance ??= MetricsService._();
    return _instance!;
  }

  /// Enable or disable metrics collection
  void setEnabled(bool enabled) {
    _enabled = enabled;
  }

  /// Check if metrics collection is enabled
  bool get isEnabled => _enabled;

  /// Track an intent execution
  void trackIntent(
    String intentType,
    MetricStatus status,
    Duration duration, {
    String? spaceId,
    int? affectedDevices,
    int? failedDevices,
  }) {
    if (!_enabled) return;

    _addEvent(MetricEvent(
      category: MetricCategory.intent,
      name: intentType,
      status: status,
      duration: duration,
      metadata: {
        if (spaceId != null) 'space_id': spaceId,
        if (affectedDevices != null) 'affected_devices': affectedDevices,
        if (failedDevices != null) 'failed_devices': failedDevices,
      },
    ));

    if (kDebugMode) {
      debugPrint(
        '[METRICS] Intent: $intentType, status: ${status.name}, '
        'duration: ${duration.inMilliseconds}ms',
      );
    }
  }

  /// Track an API retry
  void trackRetry(
    String endpoint,
    int attemptNumber,
    String errorType, {
    int? statusCode,
    Duration? delay,
  }) {
    if (!_enabled) return;

    _addEvent(MetricEvent(
      category: MetricCategory.api,
      name: 'retry',
      status: MetricStatus.partial,
      duration: delay,
      metadata: {
        'endpoint': endpoint,
        'attempt': attemptNumber,
        'error_type': errorType,
        if (statusCode != null) 'status_code': statusCode,
      },
    ));

    if (kDebugMode) {
      debugPrint(
        '[METRICS] Retry: $endpoint, attempt: $attemptNumber, error: $errorType',
      );
    }
  }

  /// Track a successful API call after retries
  void trackRetrySuccess(
    String endpoint,
    int totalAttempts,
    Duration totalDuration,
  ) {
    if (!_enabled) return;

    _addEvent(MetricEvent(
      category: MetricCategory.api,
      name: 'retry_success',
      status: MetricStatus.success,
      duration: totalDuration,
      metadata: {
        'endpoint': endpoint,
        'total_attempts': totalAttempts,
      },
    ));
  }

  /// Track a failed API call after all retries exhausted
  void trackRetryFailure(
    String endpoint,
    int totalAttempts,
    Duration totalDuration,
    String finalError,
  ) {
    if (!_enabled) return;

    _addEvent(MetricEvent(
      category: MetricCategory.api,
      name: 'retry_failure',
      status: MetricStatus.failure,
      duration: totalDuration,
      metadata: {
        'endpoint': endpoint,
        'total_attempts': totalAttempts,
        'final_error': finalError,
      },
    ));
  }

  /// Track a WebSocket event
  void trackWebSocketEvent(
    String eventType,
    MetricStatus status, {
    String? spaceId,
  }) {
    if (!_enabled) return;

    _addEvent(MetricEvent(
      category: MetricCategory.websocket,
      name: eventType,
      status: status,
      metadata: {
        if (spaceId != null) 'space_id': spaceId,
      },
    ));
  }

  /// Track a state fetch operation
  void trackStateFetch(
    String stateType,
    MetricStatus status,
    Duration duration, {
    String? spaceId,
  }) {
    if (!_enabled) return;

    _addEvent(MetricEvent(
      category: MetricCategory.state,
      name: stateType,
      status: status,
      duration: duration,
      metadata: {
        if (spaceId != null) 'space_id': spaceId,
      },
    ));
  }

  /// Get summary of intent metrics
  MetricsSummary getIntentSummary({Duration? since}) {
    return _getSummary(MetricCategory.intent, since: since);
  }

  /// Get summary of retry metrics
  MetricsSummary getRetrySummary({Duration? since}) {
    return _getSummary(MetricCategory.api, since: since);
  }

  /// Get all events (for debugging)
  List<MetricEvent> getEvents({MetricCategory? category, Duration? since}) {
    var events = _events.toList();

    if (category != null) {
      events = events.where((e) => e.category == category).toList();
    }

    if (since != null) {
      final cutoff = DateTime.now().subtract(since);
      events = events.where((e) => e.timestamp.isAfter(cutoff)).toList();
    }

    return events;
  }

  /// Get retry statistics
  Map<String, dynamic> getRetryStats({Duration? since}) {
    final retryEvents = getEvents(category: MetricCategory.api, since: since);

    final retries = retryEvents.where((e) => e.name == 'retry').toList();
    final successes = retryEvents.where((e) => e.name == 'retry_success').toList();
    final failures = retryEvents.where((e) => e.name == 'retry_failure').toList();

    return {
      'total_retries': retries.length,
      'successful_recoveries': successes.length,
      'exhausted_retries': failures.length,
      'recovery_rate': retries.isNotEmpty
          ? successes.length / (successes.length + failures.length)
          : 0.0,
      'by_error_type': _groupByMetadata(retries, 'error_type'),
    };
  }

  /// Clear all collected metrics
  void clear() {
    _events.clear();
  }

  MetricsSummary _getSummary(MetricCategory category, {Duration? since}) {
    var events = _events.where((e) => e.category == category).toList();

    if (since != null) {
      final cutoff = DateTime.now().subtract(since);
      events = events.where((e) => e.timestamp.isAfter(cutoff)).toList();
    }

    if (events.isEmpty) {
      return MetricsSummary(
        totalEvents: 0,
        successCount: 0,
        failureCount: 0,
      );
    }

    final successes = events.where((e) => e.status == MetricStatus.success).length;
    final failures = events.where((e) => e.status == MetricStatus.failure).length;

    final durations = events.where((e) => e.duration != null).map((e) => e.duration!).toList();

    Duration? avgDuration;
    Duration? maxDuration;
    Duration? minDuration;

    if (durations.isNotEmpty) {
      final totalMs = durations.fold<int>(0, (sum, d) => sum + d.inMilliseconds);
      avgDuration = Duration(milliseconds: totalMs ~/ durations.length);
      maxDuration = durations.reduce((a, b) => a > b ? a : b);
      minDuration = durations.reduce((a, b) => a < b ? a : b);
    }

    return MetricsSummary(
      totalEvents: events.length,
      successCount: successes,
      failureCount: failures,
      averageDuration: avgDuration,
      maxDuration: maxDuration,
      minDuration: minDuration,
    );
  }

  Map<String, int> _groupByMetadata(List<MetricEvent> events, String key) {
    final groups = <String, int>{};
    for (final event in events) {
      final value = event.metadata[key]?.toString() ?? 'unknown';
      groups[value] = (groups[value] ?? 0) + 1;
    }
    return groups;
  }

  void _addEvent(MetricEvent event) {
    _events.add(event);

    // Trim old events if we exceed max
    if (_events.length > _maxEvents) {
      _events.removeRange(0, _events.length - _maxEvents);
    }
  }
}
