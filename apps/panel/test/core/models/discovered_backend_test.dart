import 'package:flutter_test/flutter_test.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';

void main() {
  group('DiscoveredBackend', () {
    group('constructor', () {
      test('should create instance with required parameters', () {
        final backend = DiscoveredBackend(
          name: 'Test Backend',
          host: '192.168.1.100',
          port: 3000,
        );

        expect(backend.name, equals('Test Backend'));
        expect(backend.host, equals('192.168.1.100'));
        expect(backend.port, equals(3000));
        expect(backend.apiPath, isNull);
        expect(backend.version, isNull);
        expect(backend.isSecure, isFalse);
      });

      test('should create instance with all parameters', () {
        final backend = DiscoveredBackend(
          name: 'Test Backend',
          host: '192.168.1.100',
          port: 3000,
          apiPath: '/api/v2',
          version: '1.2.3',
          isSecure: true,
        );

        expect(backend.name, equals('Test Backend'));
        expect(backend.host, equals('192.168.1.100'));
        expect(backend.port, equals(3000));
        expect(backend.apiPath, equals('/api/v2'));
        expect(backend.version, equals('1.2.3'));
        expect(backend.isSecure, isTrue);
      });
    });

    group('baseUrl', () {
      test('should return http URL when not secure', () {
        final backend = DiscoveredBackend(
          name: 'Test Backend',
          host: '192.168.1.100',
          port: 3000,
        );

        expect(backend.baseUrl, equals('http://192.168.1.100:3000/api/v1'));
      });

      test('should return https URL when secure', () {
        final backend = DiscoveredBackend(
          name: 'Test Backend',
          host: '192.168.1.100',
          port: 3000,
          isSecure: true,
        );

        expect(backend.baseUrl, equals('https://192.168.1.100:3000/api/v1'));
      });

      test('should use custom apiPath when provided', () {
        final backend = DiscoveredBackend(
          name: 'Test Backend',
          host: '192.168.1.100',
          port: 3000,
          apiPath: '/custom/api',
        );

        expect(backend.baseUrl, equals('http://192.168.1.100:3000/custom/api'));
      });

      test('should work with hostname instead of IP', () {
        final backend = DiscoveredBackend(
          name: 'Test Backend',
          host: 'myserver.local',
          port: 8080,
        );

        expect(backend.baseUrl, equals('http://myserver.local:8080/api/v1'));
      });
    });

    group('displayAddress', () {
      test('should return host:port format', () {
        final backend = DiscoveredBackend(
          name: 'Test Backend',
          host: '192.168.1.100',
          port: 3000,
        );

        expect(backend.displayAddress, equals('192.168.1.100:3000'));
      });
    });

    group('toString', () {
      test('should return readable string representation', () {
        final backend = DiscoveredBackend(
          name: 'Test Backend',
          host: '192.168.1.100',
          port: 3000,
          version: '1.0.0',
        );

        expect(
          backend.toString(),
          equals(
            'DiscoveredBackend(name: Test Backend, host: 192.168.1.100, port: 3000, version: 1.0.0)',
          ),
        );
      });
    });

    group('equality', () {
      test('should be equal when host and port match', () {
        final backend1 = DiscoveredBackend(
          name: 'Backend 1',
          host: '192.168.1.100',
          port: 3000,
        );

        final backend2 = DiscoveredBackend(
          name: 'Backend 2',
          host: '192.168.1.100',
          port: 3000,
          version: '1.0.0',
        );

        expect(backend1, equals(backend2));
        expect(backend1.hashCode, equals(backend2.hashCode));
      });

      test('should not be equal when host differs', () {
        final backend1 = DiscoveredBackend(
          name: 'Backend 1',
          host: '192.168.1.100',
          port: 3000,
        );

        final backend2 = DiscoveredBackend(
          name: 'Backend 1',
          host: '192.168.1.101',
          port: 3000,
        );

        expect(backend1, isNot(equals(backend2)));
      });

      test('should not be equal when port differs', () {
        final backend1 = DiscoveredBackend(
          name: 'Backend 1',
          host: '192.168.1.100',
          port: 3000,
        );

        final backend2 = DiscoveredBackend(
          name: 'Backend 1',
          host: '192.168.1.100',
          port: 3001,
        );

        expect(backend1, isNot(equals(backend2)));
      });
    });
  });
}
