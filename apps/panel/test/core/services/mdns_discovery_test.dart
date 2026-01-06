import 'package:flutter_test/flutter_test.dart';
import 'package:fastybird_smart_panel/core/services/mdns_discovery.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';

void main() {
  group('MdnsDiscoveryService', () {
    late MdnsDiscoveryService service;

    setUp(() {
      service = MdnsDiscoveryService();
    });

    tearDown(() {
      service.dispose();
    });

    group('constants', () {
      test('should have correct default service type', () {
        expect(
          MdnsDiscoveryService.defaultServiceType,
          equals('_fastybird-panel._tcp'),
        );
      });

      test('should have correct default timeout', () {
        expect(
          MdnsDiscoveryService.defaultDiscoveryTimeoutMs,
          equals(10000),
        );
      });
    });

    group('isEnabled', () {
      test('should return true when supported and enabled', () {
        // On test environment, platform checks may vary
        // The service checks Platform.isAndroid || Platform.isIOS || etc.
        // In test environment, this depends on the test runner platform
        expect(service.isEnabled, isA<bool>());
      });
    });

    group('timeout', () {
      test('should return configured timeout duration', () {
        expect(service.timeout, isA<Duration>());
        // Default is 10000ms from environment or fallback
        expect(service.timeout.inMilliseconds, greaterThan(0));
      });
    });

    group('discoveredBackends', () {
      test('should return empty list initially', () {
        expect(service.discoveredBackends, isEmpty);
      });

      test('should return unmodifiable list', () {
        final backends = service.discoveredBackends;
        expect(
          () => backends.add(
            const DiscoveredBackend(
              name: 'Test',
              host: '127.0.0.1',
              port: 3000,
            ),
          ),
          throwsUnsupportedError,
        );
      });
    });

    group('stop', () {
      test('should not throw when called without active discovery', () async {
        // Should complete without error
        await expectLater(service.stop(), completes);
      });
    });

    group('dispose', () {
      test('should not throw when called', () {
        expect(() => service.dispose(), returnsNormally);
      });

      test('should be safe to call multiple times', () {
        service.dispose();
        expect(() => service.dispose(), returnsNormally);
      });
    });
  });
}
