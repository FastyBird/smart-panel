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
  });
}
