import 'dart:convert';

import 'package:fastybird_smart_panel/core/services/metrics_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() {
    // Reset to a fresh instance before each test
    MetricsService.resetForTesting();
  });

  group('MetricsService', () {
    group('singleton', () {
      test('returns same instance', () {
        final instance1 = MetricsService.instance;
        final instance2 = MetricsService.instance;

        expect(identical(instance1, instance2), isTrue);
      });

      test('resetForTesting creates new instance', () {
        final instance1 = MetricsService.instance;
        MetricsService.resetForTesting();
        final instance2 = MetricsService.instance;

        expect(identical(instance1, instance2), isFalse);
      });
    });

    group('enable/disable', () {
      test('is enabled by default', () {
        expect(MetricsService.instance.isEnabled, isTrue);
      });

      test('can be disabled', () {
        final metrics = MetricsService.instance;
        metrics.setEnabled(false);

        expect(metrics.isEnabled, isFalse);
      });

      test('does not track events when disabled', () {
        final metrics = MetricsService.instance;
        metrics.setEnabled(false);

        metrics.trackIntent(
          'test_intent',
          MetricStatus.success,
          const Duration(milliseconds: 100),
        );

        expect(metrics.getEvents().length, equals(0));
      });

      test('tracks events when re-enabled', () {
        final metrics = MetricsService.instance;
        metrics.setEnabled(false);
        metrics.setEnabled(true);

        metrics.trackIntent(
          'test_intent',
          MetricStatus.success,
          const Duration(milliseconds: 100),
        );

        expect(metrics.getEvents().length, equals(1));
      });
    });

    group('trackIntent', () {
      test('records intent execution', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent(
          'lighting_off',
          MetricStatus.success,
          const Duration(milliseconds: 150),
        );

        final events = metrics.getEvents();
        expect(events.length, equals(1));
        expect(events.first.category, equals(MetricCategory.intent));
        expect(events.first.name, equals('lighting_off'));
        expect(events.first.status, equals(MetricStatus.success));
        expect(events.first.duration, equals(const Duration(milliseconds: 150)));
      });

      test('records intent with metadata', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent(
          'lighting_mode',
          MetricStatus.success,
          const Duration(milliseconds: 200),
          spaceId: 'space-123',
          affectedDevices: 5,
          failedDevices: 1,
        );

        final events = metrics.getEvents();
        expect(events.first.metadata['space_id'], equals('space-123'));
        expect(events.first.metadata['affected_devices'], equals(5));
        expect(events.first.metadata['failed_devices'], equals(1));
      });

      test('records failure status', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent(
          'lighting_off',
          MetricStatus.failure,
          const Duration(milliseconds: 100),
        );

        final events = metrics.getEvents();
        expect(events.first.status, equals(MetricStatus.failure));
      });
    });

    group('trackRetry', () {
      test('records retry attempt', () {
        final metrics = MetricsService.instance;

        metrics.trackRetry(
          '/api/spaces/123/lighting',
          1,
          'connection_timeout',
        );

        final events = metrics.getEvents();
        expect(events.length, equals(1));
        expect(events.first.category, equals(MetricCategory.api));
        expect(events.first.name, equals('retry'));
        expect(events.first.status, equals(MetricStatus.partial));
        expect(events.first.metadata['endpoint'], equals('/api/spaces/123/lighting'));
        expect(events.first.metadata['attempt'], equals(1));
        expect(events.first.metadata['error_type'], equals('connection_timeout'));
      });

      test('records retry with optional parameters', () {
        final metrics = MetricsService.instance;

        metrics.trackRetry(
          '/api/spaces/123/lighting',
          2,
          'server_error',
          statusCode: 503,
          delay: const Duration(seconds: 2),
        );

        final events = metrics.getEvents();
        expect(events.first.metadata['status_code'], equals(503));
        expect(events.first.duration, equals(const Duration(seconds: 2)));
      });
    });

    group('trackRetrySuccess', () {
      test('records successful recovery', () {
        final metrics = MetricsService.instance;

        metrics.trackRetrySuccess(
          '/api/spaces/123/lighting',
          3,
          const Duration(seconds: 5),
        );

        final events = metrics.getEvents();
        expect(events.length, equals(1));
        expect(events.first.name, equals('retry_success'));
        expect(events.first.status, equals(MetricStatus.success));
        expect(events.first.metadata['total_attempts'], equals(3));
      });
    });

    group('trackRetryFailure', () {
      test('records exhausted retries', () {
        final metrics = MetricsService.instance;

        metrics.trackRetryFailure(
          '/api/spaces/123/lighting',
          3,
          const Duration(seconds: 10),
          'max_retries_exceeded',
        );

        final events = metrics.getEvents();
        expect(events.length, equals(1));
        expect(events.first.name, equals('retry_failure'));
        expect(events.first.status, equals(MetricStatus.failure));
        expect(events.first.metadata['final_error'], equals('max_retries_exceeded'));
      });
    });

    group('trackWebSocketEvent', () {
      test('records WebSocket event', () {
        final metrics = MetricsService.instance;

        metrics.trackWebSocketEvent(
          'LightingStateChanged',
          MetricStatus.success,
          spaceId: 'space-456',
        );

        final events = metrics.getEvents();
        expect(events.length, equals(1));
        expect(events.first.category, equals(MetricCategory.websocket));
        expect(events.first.name, equals('LightingStateChanged'));
        expect(events.first.metadata['space_id'], equals('space-456'));
      });
    });

    group('trackStateFetch', () {
      test('records state fetch operation', () {
        final metrics = MetricsService.instance;

        metrics.trackStateFetch(
          'lighting_state',
          MetricStatus.success,
          const Duration(milliseconds: 250),
          spaceId: 'space-789',
        );

        final events = metrics.getEvents();
        expect(events.length, equals(1));
        expect(events.first.category, equals(MetricCategory.state));
        expect(events.first.name, equals('lighting_state'));
        expect(events.first.duration, equals(const Duration(milliseconds: 250)));
      });
    });

    group('getIntentSummary', () {
      test('returns empty summary when no events', () {
        final metrics = MetricsService.instance;

        final summary = metrics.getIntentSummary();

        expect(summary.totalEvents, equals(0));
        expect(summary.successCount, equals(0));
        expect(summary.failureCount, equals(0));
        expect(summary.successRate, equals(0.0));
      });

      test('calculates correct counts', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
        metrics.trackIntent('b', MetricStatus.success, const Duration(milliseconds: 150));
        metrics.trackIntent('c', MetricStatus.failure, const Duration(milliseconds: 200));

        final summary = metrics.getIntentSummary();

        expect(summary.totalEvents, equals(3));
        expect(summary.successCount, equals(2));
        expect(summary.failureCount, equals(1));
      });

      test('calculates correct success rate', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
        metrics.trackIntent('b', MetricStatus.success, const Duration(milliseconds: 100));
        metrics.trackIntent('c', MetricStatus.failure, const Duration(milliseconds: 100));
        metrics.trackIntent('d', MetricStatus.failure, const Duration(milliseconds: 100));

        final summary = metrics.getIntentSummary();

        expect(summary.successRate, equals(0.5));
      });

      test('calculates duration statistics', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
        metrics.trackIntent('b', MetricStatus.success, const Duration(milliseconds: 200));
        metrics.trackIntent('c', MetricStatus.success, const Duration(milliseconds: 300));

        final summary = metrics.getIntentSummary();

        expect(summary.minDuration, equals(const Duration(milliseconds: 100)));
        expect(summary.maxDuration, equals(const Duration(milliseconds: 300)));
        expect(summary.averageDuration, equals(const Duration(milliseconds: 200)));
      });
    });

    group('getRetrySummary', () {
      test('returns API category summary', () {
        final metrics = MetricsService.instance;

        metrics.trackRetry('/api/test', 1, 'error');
        metrics.trackRetrySuccess('/api/test', 2, const Duration(seconds: 1));

        final summary = metrics.getRetrySummary();

        expect(summary.totalEvents, equals(2));
        expect(summary.successCount, equals(1));
      });
    });

    group('getEvents', () {
      test('returns all events by default', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
        metrics.trackRetry('/api/test', 1, 'error');
        metrics.trackWebSocketEvent('event', MetricStatus.success);

        expect(metrics.getEvents().length, equals(3));
      });

      test('filters by category', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
        metrics.trackRetry('/api/test', 1, 'error');
        metrics.trackWebSocketEvent('event', MetricStatus.success);

        final intentEvents = metrics.getEvents(category: MetricCategory.intent);
        expect(intentEvents.length, equals(1));
        expect(intentEvents.first.name, equals('a'));
      });
    });

    group('getRetryStats', () {
      test('returns retry statistics', () {
        final metrics = MetricsService.instance;

        metrics.trackRetry('/api/test', 1, 'timeout');
        metrics.trackRetry('/api/test', 2, 'timeout');
        metrics.trackRetrySuccess('/api/test', 2, const Duration(seconds: 2));
        metrics.trackRetry('/api/other', 1, 'server_error');
        metrics.trackRetryFailure('/api/other', 3, const Duration(seconds: 5), 'max_retries');

        final stats = metrics.getRetryStats();

        expect(stats['total_retries'], equals(3));
        expect(stats['successful_recoveries'], equals(1));
        expect(stats['exhausted_retries'], equals(1));
        expect(stats['recovery_rate'], equals(0.5));

        final byErrorType = stats['by_error_type'] as Map<String, int>;
        expect(byErrorType['timeout'], equals(2));
        expect(byErrorType['server_error'], equals(1));
      });

      test('returns zero recovery rate when no retries', () {
        final metrics = MetricsService.instance;

        final stats = metrics.getRetryStats();

        expect(stats['total_retries'], equals(0));
        expect(stats['recovery_rate'], equals(0.0));
      });
    });

    group('clear', () {
      test('removes all events', () {
        final metrics = MetricsService.instance;

        metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
        metrics.trackIntent('b', MetricStatus.success, const Duration(milliseconds: 100));
        metrics.clear();

        expect(metrics.getEvents().length, equals(0));
      });
    });

    group('event limit', () {
      test('trims old events when exceeding max', () {
        MetricsService.resetForTesting(maxEvents: 5);
        final metrics = MetricsService.instance;

        for (var i = 0; i < 10; i++) {
          metrics.trackIntent('intent_$i', MetricStatus.success, const Duration(milliseconds: 100));
        }

        final events = metrics.getEvents();
        expect(events.length, equals(5));
        // Should keep the most recent events
        expect(events.first.name, equals('intent_5'));
        expect(events.last.name, equals('intent_9'));
      });
    });
  });

  group('MetricEvent', () {
    test('toJson returns correct structure', () {
      final event = MetricEvent(
        category: MetricCategory.intent,
        name: 'test_event',
        status: MetricStatus.success,
        duration: const Duration(milliseconds: 150),
        metadata: {'key': 'value'},
      );

      final json = event.toJson();

      expect(json['category'], equals('intent'));
      expect(json['name'], equals('test_event'));
      expect(json['status'], equals('success'));
      expect(json['duration_ms'], equals(150));
      expect(json['metadata'], equals({'key': 'value'}));
      expect(json['timestamp'], isA<String>());
    });

    test('handles null duration in toJson', () {
      final event = MetricEvent(
        category: MetricCategory.api,
        name: 'test',
        status: MetricStatus.failure,
      );

      final json = event.toJson();

      expect(json['duration_ms'], isNull);
    });
  });

  group('MetricsSummary', () {
    test('calculates success rate correctly', () {
      final summary = MetricsSummary(
        totalEvents: 10,
        successCount: 7,
        failureCount: 3,
      );

      expect(summary.successRate, equals(0.7));
    });

    test('returns zero success rate when no events', () {
      final summary = MetricsSummary(
        totalEvents: 0,
        successCount: 0,
        failureCount: 0,
      );

      expect(summary.successRate, equals(0.0));
    });

    test('calculates failure rate correctly', () {
      final summary = MetricsSummary(
        totalEvents: 10,
        successCount: 7,
        failureCount: 3,
      );

      expect(summary.failureRate, equals(0.3));
    });

    test('toJson returns correct structure', () {
      final summary = MetricsSummary(
        totalEvents: 10,
        successCount: 7,
        failureCount: 2,
        partialCount: 1,
        averageDuration: const Duration(milliseconds: 150),
        minDuration: const Duration(milliseconds: 100),
        maxDuration: const Duration(milliseconds: 200),
        periodStart: DateTime(2024, 1, 1, 10, 0),
        periodEnd: DateTime(2024, 1, 1, 11, 0),
      );

      final json = summary.toJson();

      expect(json['total_events'], equals(10));
      expect(json['success_count'], equals(7));
      expect(json['failure_count'], equals(2));
      expect(json['partial_count'], equals(1));
      expect(json['success_rate'], equals(0.7));
      expect(json['failure_rate'], equals(0.2));
      expect(json['average_duration_ms'], equals(150));
      expect(json['min_duration_ms'], equals(100));
      expect(json['max_duration_ms'], equals(200));
      expect(json['period_start'], isNotNull);
      expect(json['period_end'], isNotNull);
    });
  });

  group('MetricEvent.fromJson', () {
    test('creates event from JSON correctly', () {
      final json = {
        'category': 'intent',
        'name': 'lighting_off',
        'status': 'success',
        'duration_ms': 150,
        'metadata': {'space_id': 'space-123'},
        'timestamp': '2024-01-01T10:00:00.000',
      };

      final event = MetricEvent.fromJson(json);

      expect(event.category, equals(MetricCategory.intent));
      expect(event.name, equals('lighting_off'));
      expect(event.status, equals(MetricStatus.success));
      expect(event.duration, equals(const Duration(milliseconds: 150)));
      expect(event.metadata['space_id'], equals('space-123'));
      expect(event.timestamp, equals(DateTime(2024, 1, 1, 10, 0)));
    });

    test('handles null duration', () {
      final json = {
        'category': 'api',
        'name': 'retry',
        'status': 'partial',
        'duration_ms': null,
        'metadata': {},
        'timestamp': '2024-01-01T10:00:00.000',
      };

      final event = MetricEvent.fromJson(json);

      expect(event.duration, isNull);
    });

    test('handles unknown category with fallback', () {
      final json = {
        'category': 'unknown_category',
        'name': 'test',
        'status': 'success',
        'metadata': {},
        'timestamp': '2024-01-01T10:00:00.000',
      };

      final event = MetricEvent.fromJson(json);

      expect(event.category, equals(MetricCategory.state));
    });

    test('handles unknown status with fallback', () {
      final json = {
        'category': 'intent',
        'name': 'test',
        'status': 'unknown_status',
        'metadata': {},
        'timestamp': '2024-01-01T10:00:00.000',
      };

      final event = MetricEvent.fromJson(json);

      expect(event.status, equals(MetricStatus.failure));
    });
  });

  group('MetricsFilter', () {
    test('lastHours factory creates correct filter', () {
      final filter = MetricsFilter.lastHours(24, category: MetricCategory.intent);

      expect(filter.since, equals(const Duration(hours: 24)));
      expect(filter.category, equals(MetricCategory.intent));
    });

    test('lastDays factory creates correct filter', () {
      final filter = MetricsFilter.lastDays(7, category: MetricCategory.api);

      expect(filter.since, equals(const Duration(days: 7)));
      expect(filter.category, equals(MetricCategory.api));
    });

    test('timeRange factory creates correct filter', () {
      final start = DateTime(2024, 1, 1);
      final end = DateTime(2024, 1, 31);
      final filter = MetricsFilter.timeRange(start, end);

      expect(filter.startTime, equals(start));
      expect(filter.endTime, equals(end));
    });
  });

  group('TimeAggregatedMetrics', () {
    test('toJson returns correct structure', () {
      final aggregated = TimeAggregatedMetrics(
        period: TimePeriod.hour,
        buckets: [
          MetricsSummary(totalEvents: 5, successCount: 4, failureCount: 1),
          MetricsSummary(totalEvents: 3, successCount: 2, failureCount: 1),
        ],
        overall: MetricsSummary(totalEvents: 8, successCount: 6, failureCount: 2),
      );

      final json = aggregated.toJson();

      expect(json['period'], equals('hour'));
      expect((json['buckets'] as List).length, equals(2));
      expect(json['overall'], isNotNull);
    });
  });

  group('MetricsService Export', () {
    test('exportToJson returns valid JSON', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('test', MetricStatus.success, const Duration(milliseconds: 100));

      final jsonString = metrics.exportToJson();
      final parsed = jsonDecode(jsonString);

      expect(parsed['exported_at'], isNotNull);
      expect(parsed['total_events'], equals(1));
      expect((parsed['events'] as List).length, equals(1));
    });

    test('exportToJson with filter exports filtered events', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('intent1', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackRetry('/api/test', 1, 'error');

      final jsonString = metrics.exportToJson(
        filter: const MetricsFilter(category: MetricCategory.intent),
      );
      final parsed = jsonDecode(jsonString);

      expect(parsed['total_events'], equals(1));
      expect((parsed['events'] as List).first['category'], equals('intent'));
    });

    test('exportToCsv returns valid CSV', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent(
        'test',
        MetricStatus.success,
        const Duration(milliseconds: 100),
        spaceId: 'space-123',
      );

      final csv = metrics.exportToCsv();
      final lines = csv.split('\n');

      expect(lines[0], equals('timestamp,category,name,status,duration_ms,metadata'));
      expect(lines[1], contains('intent'));
      expect(lines[1], contains('test'));
      expect(lines[1], contains('success'));
      expect(lines[1], contains('100'));
      expect(lines[1], contains('space_id=space-123'));
    });

    test('exportSummaryToJson returns comprehensive summary', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackRetry('/api/test', 1, 'error');

      final jsonString = metrics.exportSummaryToJson();
      final parsed = jsonDecode(jsonString);

      expect(parsed['exported_at'], isNotNull);
      expect(parsed['intent_summary'], isNotNull);
      expect(parsed['retry_summary'], isNotNull);
      expect(parsed['retry_stats'], isNotNull);
      expect(parsed['by_category'], isNotNull);
    });
  });

  group('MetricsService Visualization', () {
    test('getFormattedSummary returns formatted string', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('test', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('test2', MetricStatus.failure, const Duration(milliseconds: 200));

      final summary = metrics.getFormattedSummary();

      expect(summary, contains('METRICS SUMMARY'));
      expect(summary, contains('INTENT'));
      expect(summary, contains('Total Events'));
      expect(summary, contains('Success'));
      expect(summary, contains('Failure'));
    });

    test('getFormattedSummary filters by category', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('test', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackRetry('/api/test', 1, 'error');

      final summary = metrics.getFormattedSummary(category: MetricCategory.intent);

      expect(summary, contains('INTENT'));
      expect(summary, isNot(contains('API')));
    });

    test('getFormattedReport returns detailed report', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('lighting_off', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackRetry('/api/test', 1, 'timeout');
      metrics.trackRetrySuccess('/api/test', 2, const Duration(seconds: 1));

      final report = metrics.getFormattedReport();

      expect(report, contains('METRICS DETAILED REPORT'));
      expect(report, contains('RETRY STATISTICS'));
      expect(report, contains('TOP EVENTS BY NAME'));
      expect(report, contains('lighting_off'));
    });
  });

  group('MetricsService Time Aggregation', () {
    test('aggregateByTimePeriod returns empty for no events', () {
      final metrics = MetricsService.instance;

      final aggregated = metrics.aggregateByTimePeriod(TimePeriod.hour);

      expect(aggregated.buckets, isEmpty);
      expect(aggregated.overall.totalEvents, equals(0));
    });

    test('aggregateByTimePeriod groups events by hour', () {
      final metrics = MetricsService.instance;

      // Add events (they will all be in current hour since timestamp is auto-set)
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('b', MetricStatus.failure, const Duration(milliseconds: 200));
      metrics.trackIntent('c', MetricStatus.success, const Duration(milliseconds: 150));

      final aggregated = metrics.aggregateByTimePeriod(
        TimePeriod.hour,
        category: MetricCategory.intent,
      );

      expect(aggregated.period, equals(TimePeriod.hour));
      expect(aggregated.buckets.length, equals(1)); // All in same hour
      expect(aggregated.overall.totalEvents, equals(3));
      expect(aggregated.overall.successCount, equals(2));
      expect(aggregated.overall.failureCount, equals(1));
    });

    test('aggregateByTimePeriod filters by category', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackRetry('/api/test', 1, 'error');

      final aggregated = metrics.aggregateByTimePeriod(
        TimePeriod.day,
        category: MetricCategory.intent,
      );

      expect(aggregated.overall.totalEvents, equals(1));
    });

    test('bucket summaries include period timestamps', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));

      final aggregated = metrics.aggregateByTimePeriod(TimePeriod.hour);

      expect(aggregated.buckets.first.periodStart, isNotNull);
      expect(aggregated.buckets.first.periodEnd, isNotNull);
    });
  });

  group('MetricsService Advanced Filtering', () {
    test('queryEvents filters by category', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackRetry('/api/test', 1, 'error');

      final events = metrics.queryEvents(
        const MetricsFilter(category: MetricCategory.intent),
      );

      expect(events.length, equals(1));
      expect(events.first.category, equals(MetricCategory.intent));
    });

    test('queryEvents filters by name', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('lighting_off', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('lighting_mode', MetricStatus.success, const Duration(milliseconds: 100));

      final events = metrics.queryEvents(
        const MetricsFilter(name: 'lighting_off'),
      );

      expect(events.length, equals(1));
      expect(events.first.name, equals('lighting_off'));
    });

    test('queryEvents filters by status', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('b', MetricStatus.failure, const Duration(milliseconds: 100));
      metrics.trackIntent('c', MetricStatus.success, const Duration(milliseconds: 100));

      final events = metrics.queryEvents(
        const MetricsFilter(status: MetricStatus.failure),
      );

      expect(events.length, equals(1));
      expect(events.first.name, equals('b'));
    });

    test('queryEvents filters by metadata match', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent(
        'a',
        MetricStatus.success,
        const Duration(milliseconds: 100),
        spaceId: 'space-123',
      );
      metrics.trackIntent(
        'b',
        MetricStatus.success,
        const Duration(milliseconds: 100),
        spaceId: 'space-456',
      );

      final events = metrics.queryEvents(
        const MetricsFilter(metadataMatch: {'space_id': 'space-123'}),
      );

      expect(events.length, equals(1));
      expect(events.first.metadata['space_id'], equals('space-123'));
    });

    test('queryEvents combines multiple filters', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent(
        'lighting_off',
        MetricStatus.success,
        const Duration(milliseconds: 100),
        spaceId: 'space-123',
      );
      metrics.trackIntent(
        'lighting_off',
        MetricStatus.failure,
        const Duration(milliseconds: 100),
        spaceId: 'space-123',
      );
      metrics.trackIntent(
        'lighting_mode',
        MetricStatus.success,
        const Duration(milliseconds: 100),
        spaceId: 'space-123',
      );

      final events = metrics.queryEvents(
        const MetricsFilter(
          name: 'lighting_off',
          status: MetricStatus.success,
        ),
      );

      expect(events.length, equals(1));
    });

    test('getSummaryForFilter returns summary for filtered events', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('b', MetricStatus.failure, const Duration(milliseconds: 200));
      metrics.trackRetry('/api/test', 1, 'error');

      final summary = metrics.getSummaryForFilter(
        const MetricsFilter(category: MetricCategory.intent),
      );

      expect(summary.totalEvents, equals(2));
      expect(summary.successCount, equals(1));
      expect(summary.failureCount, equals(1));
    });

    test('countEvents returns correct count', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('b', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackRetry('/api/test', 1, 'error');

      final count = metrics.countEvents(
        const MetricsFilter(category: MetricCategory.intent),
      );

      expect(count, equals(2));
    });

    test('getUniqueEventNames returns unique names', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('lighting_off', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('lighting_off', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('lighting_mode', MetricStatus.success, const Duration(milliseconds: 100));

      final names = metrics.getUniqueEventNames(category: MetricCategory.intent);

      expect(names.length, equals(2));
      expect(names, contains('lighting_off'));
      expect(names, contains('lighting_mode'));
    });

    test('groupByMetadataKey groups events correctly', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent(
        'a',
        MetricStatus.success,
        const Duration(milliseconds: 100),
        spaceId: 'space-123',
      );
      metrics.trackIntent(
        'b',
        MetricStatus.success,
        const Duration(milliseconds: 100),
        spaceId: 'space-123',
      );
      metrics.trackIntent(
        'c',
        MetricStatus.success,
        const Duration(milliseconds: 100),
        spaceId: 'space-456',
      );

      final groups = metrics.groupByMetadataKey('space_id');

      expect(groups.length, equals(2));
      expect(groups['space-123']!.length, equals(2));
      expect(groups['space-456']!.length, equals(1));
    });

    test('groupByMetadataKey uses unknown for missing key', () {
      final metrics = MetricsService.instance;
      metrics.trackIntent('a', MetricStatus.success, const Duration(milliseconds: 100));

      final groups = metrics.groupByMetadataKey('space_id');

      expect(groups.length, equals(1));
      expect(groups.containsKey('unknown'), isTrue);
    });
  });

  group('MetricsService Persistence', () {
    late InMemoryMetricsStorage storage;

    setUp(() {
      storage = InMemoryMetricsStorage();
      MetricsService.resetForTesting(storage: storage);
    });

    test('hasStorage returns false when no storage set', () {
      MetricsService.resetForTesting();
      expect(MetricsService.instance.hasStorage, isFalse);
    });

    test('hasStorage returns true when storage is set', () {
      expect(MetricsService.instance.hasStorage, isTrue);
    });

    test('save returns false when no storage configured', () async {
      MetricsService.resetForTesting();
      final metrics = MetricsService.instance;
      metrics.trackIntent('test', MetricStatus.success, const Duration(milliseconds: 100));

      final result = await metrics.save();

      expect(result, isFalse);
    });

    test('save persists events to storage', () async {
      final metrics = MetricsService.instance;
      metrics.trackIntent('test', MetricStatus.success, const Duration(milliseconds: 100));

      final result = await metrics.save();

      expect(result, isTrue);
    });

    test('load restores events from storage', () async {
      final metrics = MetricsService.instance;
      metrics.trackIntent('test1', MetricStatus.success, const Duration(milliseconds: 100));
      metrics.trackIntent('test2', MetricStatus.failure, const Duration(milliseconds: 200));

      await metrics.save();

      // Create new instance with same storage
      MetricsService.resetForTesting(storage: storage);
      final newMetrics = MetricsService.instance;
      expect(newMetrics.getEvents().length, equals(0));

      final loadedCount = await newMetrics.load();

      expect(loadedCount, equals(2));
      expect(newMetrics.getEvents().length, equals(2));
    });

    test('load returns 0 when no storage configured', () async {
      MetricsService.resetForTesting();
      final metrics = MetricsService.instance;

      final loadedCount = await metrics.load();

      expect(loadedCount, equals(0));
    });

    test('load returns 0 for empty storage', () async {
      final metrics = MetricsService.instance;

      final loadedCount = await metrics.load();

      expect(loadedCount, equals(0));
    });

    test('clearStorage removes persisted data', () async {
      final metrics = MetricsService.instance;
      metrics.trackIntent('test', MetricStatus.success, const Duration(milliseconds: 100));
      await metrics.save();

      final result = await metrics.clearStorage();

      expect(result, isTrue);

      MetricsService.resetForTesting(storage: storage);
      final loadedCount = await MetricsService.instance.load();
      expect(loadedCount, equals(0));
    });

    test('clearStorage returns false when no storage configured', () async {
      MetricsService.resetForTesting();
      final result = await MetricsService.instance.clearStorage();

      expect(result, isFalse);
    });

    test('load respects max events limit', () async {
      // Pre-populate storage with 20 events
      final jsonData = jsonEncode([
        for (var i = 0; i < 20; i++)
          {
            'category': 'intent',
            'name': 'event_$i',
            'status': 'success',
            'metadata': <String, dynamic>{},
            'timestamp': DateTime.now().toIso8601String(),
          },
      ]);
      await storage.save('metrics_service_events', jsonData);

      MetricsService.resetForTesting(maxEvents: 10, storage: storage);
      final metrics = MetricsService.instance;

      final loadedCount = await metrics.load();

      expect(loadedCount, equals(10));
      expect(metrics.getEvents().length, equals(10));
    });

    test('setStorage allows changing storage after creation', () async {
      MetricsService.resetForTesting();
      final metrics = MetricsService.instance;
      expect(metrics.hasStorage, isFalse);

      metrics.setStorage(storage);
      expect(metrics.hasStorage, isTrue);

      metrics.trackIntent('test', MetricStatus.success, const Duration(milliseconds: 100));
      final result = await metrics.save();
      expect(result, isTrue);
    });
  });

  group('InMemoryMetricsStorage', () {
    test('save and load work correctly', () async {
      final storage = InMemoryMetricsStorage();

      await storage.save('key', 'value');
      final result = await storage.load('key');

      expect(result, equals('value'));
    });

    test('load returns null for non-existent key', () async {
      final storage = InMemoryMetricsStorage();

      final result = await storage.load('non-existent');

      expect(result, isNull);
    });

    test('remove deletes data', () async {
      final storage = InMemoryMetricsStorage();
      await storage.save('key', 'value');

      final result = await storage.remove('key');
      expect(result, isTrue);

      final loaded = await storage.load('key');
      expect(loaded, isNull);
    });

    test('clear removes all data', () async {
      final storage = InMemoryMetricsStorage();
      await storage.save('key1', 'value1');
      await storage.save('key2', 'value2');

      storage.clear();

      expect(await storage.load('key1'), isNull);
      expect(await storage.load('key2'), isNull);
    });
  });
}
