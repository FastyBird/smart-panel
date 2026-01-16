import 'dart:convert';

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
    DateTime? timestamp,
  })  : metadata = metadata ?? {},
        timestamp = timestamp ?? DateTime.now();

  /// Create a MetricEvent from JSON (for loading persisted metrics)
  factory MetricEvent.fromJson(Map<String, dynamic> json) {
    return MetricEvent(
      category: MetricCategory.values.firstWhere(
        (c) => c.name == json['category'],
        orElse: () => MetricCategory.state,
      ),
      name: json['name'] as String,
      status: MetricStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => MetricStatus.failure,
      ),
      duration: json['duration_ms'] != null
          ? Duration(milliseconds: json['duration_ms'] as int)
          : null,
      metadata: Map<String, dynamic>.from(json['metadata'] ?? {}),
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

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
  final int partialCount;
  final Duration? averageDuration;
  final Duration? maxDuration;
  final Duration? minDuration;
  final DateTime? periodStart;
  final DateTime? periodEnd;

  MetricsSummary({
    required this.totalEvents,
    required this.successCount,
    required this.failureCount,
    this.partialCount = 0,
    this.averageDuration,
    this.maxDuration,
    this.minDuration,
    this.periodStart,
    this.periodEnd,
  });

  double get successRate => totalEvents > 0 ? successCount / totalEvents : 0.0;
  double get failureRate => totalEvents > 0 ? failureCount / totalEvents : 0.0;

  Map<String, dynamic> toJson() => {
        'total_events': totalEvents,
        'success_count': successCount,
        'failure_count': failureCount,
        'partial_count': partialCount,
        'success_rate': successRate,
        'failure_rate': failureRate,
        'average_duration_ms': averageDuration?.inMilliseconds,
        'max_duration_ms': maxDuration?.inMilliseconds,
        'min_duration_ms': minDuration?.inMilliseconds,
        'period_start': periodStart?.toIso8601String(),
        'period_end': periodEnd?.toIso8601String(),
      };
}

/// Time period for metrics aggregation
enum TimePeriod {
  hour,
  day,
  week,
  month,
}

/// Filter criteria for metrics queries
class MetricsFilter {
  final MetricCategory? category;
  final String? name;
  final MetricStatus? status;
  final Duration? since;
  final DateTime? startTime;
  final DateTime? endTime;
  final Map<String, dynamic>? metadataMatch;

  const MetricsFilter({
    this.category,
    this.name,
    this.status,
    this.since,
    this.startTime,
    this.endTime,
    this.metadataMatch,
  });

  /// Create a filter for events in the last N hours
  factory MetricsFilter.lastHours(int hours, {MetricCategory? category}) {
    return MetricsFilter(
      category: category,
      since: Duration(hours: hours),
    );
  }

  /// Create a filter for events in the last N days
  factory MetricsFilter.lastDays(int days, {MetricCategory? category}) {
    return MetricsFilter(
      category: category,
      since: Duration(days: days),
    );
  }

  /// Create a filter for a specific time range
  factory MetricsFilter.timeRange(
    DateTime start,
    DateTime end, {
    MetricCategory? category,
  }) {
    return MetricsFilter(
      category: category,
      startTime: start,
      endTime: end,
    );
  }
}

/// Aggregated metrics grouped by time period
class TimeAggregatedMetrics {
  final TimePeriod period;
  final List<MetricsSummary> buckets;
  final MetricsSummary overall;

  TimeAggregatedMetrics({
    required this.period,
    required this.buckets,
    required this.overall,
  });

  Map<String, dynamic> toJson() => {
        'period': period.name,
        'buckets': buckets.map((b) => b.toJson()).toList(),
        'overall': overall.toJson(),
      };
}

/// Abstract interface for metrics storage
///
/// Implement this interface to provide custom persistence for metrics.
/// Example implementations could use SharedPreferences, Hive, or file storage.
abstract class MetricsStorage {
  /// Save metrics data to storage
  Future<bool> save(String key, String data);

  /// Load metrics data from storage
  Future<String?> load(String key);

  /// Remove metrics data from storage
  Future<bool> remove(String key);
}

/// In-memory storage implementation (no persistence, for testing)
class InMemoryMetricsStorage implements MetricsStorage {
  final Map<String, String> _data = {};

  @override
  Future<bool> save(String key, String data) async {
    _data[key] = data;
    return true;
  }

  @override
  Future<String?> load(String key) async {
    return _data[key];
  }

  @override
  Future<bool> remove(String key) async {
    _data.remove(key);
    return true;
  }

  /// Clear all stored data (for testing)
  void clear() {
    _data.clear();
  }
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
  MetricsStorage? _storage;

  MetricsService._({
    int maxEvents = 1000,
    bool enabled = true,
    MetricsStorage? storage,
  })  : _maxEvents = maxEvents,
        _enabled = enabled,
        _storage = storage;

  /// Singleton instance
  static MetricsService get instance {
    _instance ??= MetricsService._();
    return _instance!;
  }

  /// Reset the singleton instance (for testing only)
  @visibleForTesting
  static void resetForTesting({
    int maxEvents = 1000,
    bool enabled = true,
    MetricsStorage? storage,
  }) {
    _instance = MetricsService._(
      maxEvents: maxEvents,
      enabled: enabled,
      storage: storage,
    );
  }

  /// Set the storage implementation for persistence
  ///
  /// Call this before using save/load if you want persistence.
  /// If no storage is set, save/load will return failure/empty.
  void setStorage(MetricsStorage storage) {
    _storage = storage;
  }

  /// Check if storage is configured
  bool get hasStorage => _storage != null;

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

    final totalCompleted = successes.length + failures.length;
    return {
      'total_retries': retries.length,
      'successful_recoveries': successes.length,
      'exhausted_retries': failures.length,
      'recovery_rate': totalCompleted > 0
          ? successes.length / totalCompleted
          : 0.0,
      'by_error_type': _groupByMetadata(retries, 'error_type'),
    };
  }

  /// Clear all collected metrics
  void clear() {
    _events.clear();
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  static const String _storageKey = 'metrics_service_events';

  /// Save metrics to persistent storage
  ///
  /// Returns true if save was successful.
  /// Requires setStorage() to be called first with a storage implementation.
  Future<bool> save() async {
    if (_storage == null) {
      if (kDebugMode) {
        debugPrint('[METRICS] No storage configured, cannot save');
      }
      return false;
    }

    try {
      final jsonList = _events.map((e) => e.toJson()).toList();
      final jsonString = jsonEncode(jsonList);
      return await _storage!.save(_storageKey, jsonString);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[METRICS] Error saving metrics: $e');
      }
      return false;
    }
  }

  /// Load metrics from persistent storage
  ///
  /// Returns the number of events loaded, or -1 on error.
  /// Returns 0 if no storage is configured or storage is empty.
  Future<int> load() async {
    if (_storage == null) {
      if (kDebugMode) {
        debugPrint('[METRICS] No storage configured, cannot load');
      }
      return 0;
    }

    try {
      final jsonString = await _storage!.load(_storageKey);

      if (jsonString == null || jsonString.isEmpty) {
        return 0;
      }

      final jsonList = jsonDecode(jsonString) as List<dynamic>;
      final loadedEvents = jsonList
          .map((json) => MetricEvent.fromJson(json as Map<String, dynamic>))
          .toList();

      _events.clear();
      _events.addAll(loadedEvents);

      // Enforce max events limit
      if (_events.length > _maxEvents) {
        _events.removeRange(0, _events.length - _maxEvents);
      }

      if (kDebugMode) {
        debugPrint('[METRICS] Loaded ${_events.length} events from storage');
      }

      return _events.length;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[METRICS] Error loading metrics: $e');
      }
      return -1;
    }
  }

  /// Clear persisted metrics from storage
  ///
  /// Returns true if clear was successful.
  /// Returns false if no storage is configured.
  Future<bool> clearStorage() async {
    if (_storage == null) {
      return false;
    }

    try {
      return await _storage!.remove(_storageKey);
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // EXPORT FUNCTIONALITY
  // ============================================

  /// Export all metrics to JSON string
  String exportToJson({MetricsFilter? filter}) {
    final events = filter != null ? queryEvents(filter) : _events;
    final jsonList = events.map((e) => e.toJson()).toList();
    return const JsonEncoder.withIndent('  ').convert({
      'exported_at': DateTime.now().toIso8601String(),
      'total_events': events.length,
      'events': jsonList,
    });
  }

  /// Export metrics to CSV format
  String exportToCsv({MetricsFilter? filter}) {
    final events = filter != null ? queryEvents(filter) : _events;
    final buffer = StringBuffer();

    // Header
    buffer.writeln(
      'timestamp,category,name,status,duration_ms,metadata',
    );

    // Data rows
    for (final event in events) {
      final metadataStr = event.metadata.entries
          .map((e) => '${e.key}=${e.value}')
          .join(';');
      buffer.writeln(
        '${event.timestamp.toIso8601String()},'
        '${event.category.name},'
        '${event.name},'
        '${event.status.name},'
        '${event.duration?.inMilliseconds ?? ""},'
        '"$metadataStr"',
      );
    }

    return buffer.toString();
  }

  /// Export summary report to JSON
  String exportSummaryToJson() {
    return const JsonEncoder.withIndent('  ').convert({
      'exported_at': DateTime.now().toIso8601String(),
      'intent_summary': getIntentSummary().toJson(),
      'retry_summary': getRetrySummary().toJson(),
      'retry_stats': getRetryStats(),
      'by_category': {
        for (final category in MetricCategory.values)
          category.name: _getSummary(category).toJson(),
      },
    });
  }

  // ============================================
  // VISUALIZATION
  // ============================================

  /// Get a formatted text summary for display/logging
  String getFormattedSummary({MetricCategory? category, Duration? since}) {
    final buffer = StringBuffer();
    final timestamp = DateTime.now().toIso8601String();

    buffer.writeln('═══════════════════════════════════════════');
    buffer.writeln('METRICS SUMMARY - $timestamp');
    buffer.writeln('═══════════════════════════════════════════');

    if (category != null) {
      _writeFormattedCategorySummary(buffer, category, since);
    } else {
      for (final cat in MetricCategory.values) {
        _writeFormattedCategorySummary(buffer, cat, since);
        buffer.writeln();
      }
    }

    return buffer.toString();
  }

  void _writeFormattedCategorySummary(
    StringBuffer buffer,
    MetricCategory category,
    Duration? since,
  ) {
    final summary = _getSummary(category, since: since);

    buffer.writeln('📊 ${category.name.toUpperCase()}');
    buffer.writeln('───────────────────────────────────────────');
    buffer.writeln('  Total Events:    ${summary.totalEvents}');
    buffer.writeln('  ✅ Success:      ${summary.successCount} (${(summary.successRate * 100).toStringAsFixed(1)}%)');
    buffer.writeln('  ❌ Failure:      ${summary.failureCount} (${(summary.failureRate * 100).toStringAsFixed(1)}%)');
    buffer.writeln('  ⏳ Partial:      ${summary.partialCount}');

    if (summary.averageDuration != null) {
      buffer.writeln('  ⏱️  Avg Duration: ${summary.averageDuration!.inMilliseconds}ms');
      buffer.writeln('  ⏱️  Min Duration: ${summary.minDuration!.inMilliseconds}ms');
      buffer.writeln('  ⏱️  Max Duration: ${summary.maxDuration!.inMilliseconds}ms');
    }
  }

  /// Get a detailed report including top events and error breakdown
  String getFormattedReport({Duration? since}) {
    final buffer = StringBuffer();
    final timestamp = DateTime.now().toIso8601String();

    buffer.writeln('╔═══════════════════════════════════════════╗');
    buffer.writeln('║       METRICS DETAILED REPORT             ║');
    buffer.writeln('║       $timestamp       ║');
    buffer.writeln('╚═══════════════════════════════════════════╝');
    buffer.writeln();

    // Overall summary
    buffer.write(getFormattedSummary(since: since));
    buffer.writeln();

    // Retry statistics
    final retryStats = getRetryStats(since: since);
    buffer.writeln('🔄 RETRY STATISTICS');
    buffer.writeln('───────────────────────────────────────────');
    buffer.writeln('  Total Retries:       ${retryStats['total_retries']}');
    buffer.writeln('  Successful Recovery: ${retryStats['successful_recoveries']}');
    buffer.writeln('  Exhausted Retries:   ${retryStats['exhausted_retries']}');
    buffer.writeln('  Recovery Rate:       ${((retryStats['recovery_rate'] as double) * 100).toStringAsFixed(1)}%');
    buffer.writeln();

    // Error type breakdown
    final byErrorType = retryStats['by_error_type'] as Map<String, int>;
    if (byErrorType.isNotEmpty) {
      buffer.writeln('  By Error Type:');
      for (final entry in byErrorType.entries) {
        buffer.writeln('    - ${entry.key}: ${entry.value}');
      }
    }
    buffer.writeln();

    // Top events by name
    buffer.writeln('📈 TOP EVENTS BY NAME');
    buffer.writeln('───────────────────────────────────────────');
    final eventsByName = _groupByName(_events);
    final sortedNames = eventsByName.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    for (final entry in sortedNames.take(10)) {
      buffer.writeln('  ${entry.key}: ${entry.value}');
    }

    return buffer.toString();
  }

  Map<String, int> _groupByName(List<MetricEvent> events) {
    final groups = <String, int>{};
    for (final event in events) {
      groups[event.name] = (groups[event.name] ?? 0) + 1;
    }
    return groups;
  }

  // ============================================
  // TIME PERIOD AGGREGATION
  // ============================================

  /// Aggregate metrics by time period
  ///
  /// Groups events into buckets based on the specified time period
  /// and calculates summary statistics for each bucket.
  TimeAggregatedMetrics aggregateByTimePeriod(
    TimePeriod period, {
    MetricCategory? category,
    Duration? since,
  }) {
    var events = category != null
        ? _events.where((e) => e.category == category).toList()
        : _events.toList();

    if (since != null) {
      final cutoff = DateTime.now().subtract(since);
      events = events.where((e) => e.timestamp.isAfter(cutoff)).toList();
    }

    if (events.isEmpty) {
      return TimeAggregatedMetrics(
        period: period,
        buckets: [],
        overall: MetricsSummary(
          totalEvents: 0,
          successCount: 0,
          failureCount: 0,
        ),
      );
    }

    // Group events by time bucket
    final buckets = <DateTime, List<MetricEvent>>{};

    for (final event in events) {
      final bucketKey = _getBucketKey(event.timestamp, period);
      buckets.putIfAbsent(bucketKey, () => []).add(event);
    }

    // Sort buckets by time
    final sortedKeys = buckets.keys.toList()..sort();

    // Calculate summary for each bucket
    final bucketSummaries = sortedKeys.map((key) {
      final bucketEvents = buckets[key]!;
      return _createSummaryFromEvents(
        bucketEvents,
        periodStart: key,
        periodEnd: _getNextBucketKey(key, period),
      );
    }).toList();

    // Calculate overall summary
    final overall = _createSummaryFromEvents(events);

    return TimeAggregatedMetrics(
      period: period,
      buckets: bucketSummaries,
      overall: overall,
    );
  }

  DateTime _getBucketKey(DateTime timestamp, TimePeriod period) {
    switch (period) {
      case TimePeriod.hour:
        return DateTime(
          timestamp.year,
          timestamp.month,
          timestamp.day,
          timestamp.hour,
        );
      case TimePeriod.day:
        return DateTime(timestamp.year, timestamp.month, timestamp.day);
      case TimePeriod.week:
        // Start of week (Monday)
        final weekday = timestamp.weekday;
        return DateTime(
          timestamp.year,
          timestamp.month,
          timestamp.day - (weekday - 1),
        );
      case TimePeriod.month:
        return DateTime(timestamp.year, timestamp.month);
    }
  }

  DateTime _getNextBucketKey(DateTime current, TimePeriod period) {
    switch (period) {
      case TimePeriod.hour:
        return current.add(const Duration(hours: 1));
      case TimePeriod.day:
        return current.add(const Duration(days: 1));
      case TimePeriod.week:
        return current.add(const Duration(days: 7));
      case TimePeriod.month:
        return DateTime(current.year, current.month + 1);
    }
  }

  MetricsSummary _createSummaryFromEvents(
    List<MetricEvent> events, {
    DateTime? periodStart,
    DateTime? periodEnd,
  }) {
    if (events.isEmpty) {
      return MetricsSummary(
        totalEvents: 0,
        successCount: 0,
        failureCount: 0,
        periodStart: periodStart,
        periodEnd: periodEnd,
      );
    }

    final successes =
        events.where((e) => e.status == MetricStatus.success).length;
    final failures =
        events.where((e) => e.status == MetricStatus.failure).length;
    final partials =
        events.where((e) => e.status == MetricStatus.partial).length;

    final durations =
        events.where((e) => e.duration != null).map((e) => e.duration!).toList();

    Duration? avgDuration;
    Duration? maxDuration;
    Duration? minDuration;

    if (durations.isNotEmpty) {
      final totalMs =
          durations.fold<int>(0, (sum, d) => sum + d.inMilliseconds);
      avgDuration = Duration(milliseconds: totalMs ~/ durations.length);
      maxDuration = durations.reduce((a, b) => a > b ? a : b);
      minDuration = durations.reduce((a, b) => a < b ? a : b);
    }

    return MetricsSummary(
      totalEvents: events.length,
      successCount: successes,
      failureCount: failures,
      partialCount: partials,
      averageDuration: avgDuration,
      maxDuration: maxDuration,
      minDuration: minDuration,
      periodStart: periodStart,
      periodEnd: periodEnd,
    );
  }

  // ============================================
  // ADVANCED FILTERING
  // ============================================

  /// Query events with flexible filtering
  ///
  /// Supports filtering by category, name, status, time range, and metadata.
  List<MetricEvent> queryEvents(MetricsFilter filter) {
    var events = _events.toList();

    // Filter by category
    if (filter.category != null) {
      events = events.where((e) => e.category == filter.category).toList();
    }

    // Filter by name
    if (filter.name != null) {
      events = events.where((e) => e.name == filter.name).toList();
    }

    // Filter by status
    if (filter.status != null) {
      events = events.where((e) => e.status == filter.status).toList();
    }

    // Filter by time (since duration)
    if (filter.since != null) {
      final cutoff = DateTime.now().subtract(filter.since!);
      events = events.where((e) => e.timestamp.isAfter(cutoff)).toList();
    }

    // Filter by time range
    if (filter.startTime != null) {
      events =
          events.where((e) => e.timestamp.isAfter(filter.startTime!)).toList();
    }
    if (filter.endTime != null) {
      events =
          events.where((e) => e.timestamp.isBefore(filter.endTime!)).toList();
    }

    // Filter by metadata match
    if (filter.metadataMatch != null) {
      events = events.where((e) {
        for (final entry in filter.metadataMatch!.entries) {
          if (e.metadata[entry.key] != entry.value) {
            return false;
          }
        }
        return true;
      }).toList();
    }

    return events;
  }

  /// Get summary for filtered events
  MetricsSummary getSummaryForFilter(MetricsFilter filter) {
    final events = queryEvents(filter);
    return _createSummaryFromEvents(events);
  }

  /// Count events matching a filter
  int countEvents(MetricsFilter filter) {
    return queryEvents(filter).length;
  }

  /// Get unique event names
  Set<String> getUniqueEventNames({MetricCategory? category}) {
    var events = _events.toList();
    if (category != null) {
      events = events.where((e) => e.category == category).toList();
    }
    return events.map((e) => e.name).toSet();
  }

  /// Get events grouped by a metadata key
  Map<String, List<MetricEvent>> groupByMetadataKey(
    String key, {
    MetricsFilter? filter,
  }) {
    final events = filter != null ? queryEvents(filter) : _events;
    final groups = <String, List<MetricEvent>>{};

    for (final event in events) {
      final value = event.metadata[key]?.toString() ?? 'unknown';
      groups.putIfAbsent(value, () => []).add(event);
    }

    return groups;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  MetricsSummary _getSummary(MetricCategory category, {Duration? since}) {
    var events = _events.where((e) => e.category == category).toList();

    if (since != null) {
      final cutoff = DateTime.now().subtract(since);
      events = events.where((e) => e.timestamp.isAfter(cutoff)).toList();
    }

    return _createSummaryFromEvents(events);
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
