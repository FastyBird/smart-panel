import 'package:fastybird_smart_panel/modules/energy/models/energy_summary.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_timeseries.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_breakdown.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EnergySummary', () {
    test('should parse consumption-only summary from JSON', () {
      final json = {
        'consumption': 15.2,
        'range': 'today',
      };

      final summary = EnergySummary.fromJson(json);

      expect(summary.consumption, 15.2);
      expect(summary.production, isNull);
      expect(summary.net, isNull);
      expect(summary.range, 'today');
      expect(summary.hasProduction, isFalse);
    });

    test('should parse summary with production from JSON', () {
      final json = {
        'consumption': 15.2,
        'production': 8.5,
        'net': 6.7,
        'range': 'today',
      };

      final summary = EnergySummary.fromJson(json);

      expect(summary.consumption, 15.2);
      expect(summary.production, 8.5);
      expect(summary.net, 6.7);
      expect(summary.range, 'today');
      expect(summary.hasProduction, isTrue);
    });

    test('should handle string numeric values', () {
      final json = {
        'consumption': '12.5',
        'range': 'week',
      };

      final summary = EnergySummary.fromJson(json);

      expect(summary.consumption, 12.5);
    });

    test('should handle zero production as no production', () {
      final json = {
        'consumption': 10.0,
        'production': 0.0,
        'range': 'today',
      };

      final summary = EnergySummary.fromJson(json);

      expect(summary.hasProduction, isFalse);
    });
  });

  group('EnergyTimeseries', () {
    test('should parse timeseries with consumption only', () {
      final json = {
        'range': 'today',
        'interval': '1h',
        'series': [
          {
            'timestamp': '2024-01-01T00:00:00Z',
            'consumption': 1.2,
            'production': 0.0,
          },
          {
            'timestamp': '2024-01-01T01:00:00Z',
            'consumption': 2.3,
            'production': 0.0,
          },
        ],
      };

      final timeseries = EnergyTimeseries.fromJson(json);

      expect(timeseries.range, 'today');
      expect(timeseries.interval, '1h');
      expect(timeseries.points.length, 2);
      expect(timeseries.hasProduction, isFalse);
      expect(timeseries.isEmpty, isFalse);
      expect(timeseries.points[0].consumption, 1.2);
      expect(timeseries.points[1].consumption, 2.3);
    });

    test('should detect production in timeseries', () {
      final json = {
        'range': 'today',
        'interval': '1h',
        'series': [
          {
            'timestamp': '2024-01-01T10:00:00Z',
            'consumption': 1.0,
            'production': 3.5,
          },
        ],
      };

      final timeseries = EnergyTimeseries.fromJson(json);

      expect(timeseries.hasProduction, isTrue);
      expect(timeseries.points[0].production, 3.5);
    });

    test('should handle empty series', () {
      final json = {
        'range': 'today',
        'interval': '1h',
        'series': [],
      };

      final timeseries = EnergyTimeseries.fromJson(json);

      expect(timeseries.isEmpty, isTrue);
      expect(timeseries.hasProduction, isFalse);
    });
  });

  group('EnergyBreakdown', () {
    test('should parse breakdown with devices', () {
      final json = {
        'range': 'today',
        'devices': [
          {
            'device_id': 'abc123',
            'device_name': 'Kitchen Outlet',
            'consumption': 5.2,
            'room_name': 'Kitchen',
          },
          {
            'device_id': 'def456',
            'device_name': 'Living Room TV',
            'consumption': 3.1,
          },
        ],
      };

      final breakdown = EnergyBreakdown.fromJson(json);

      expect(breakdown.range, 'today');
      expect(breakdown.devices.length, 2);
      expect(breakdown.devices[0].deviceName, 'Kitchen Outlet');
      expect(breakdown.devices[0].consumption, 5.2);
      expect(breakdown.devices[0].roomName, 'Kitchen');
      expect(breakdown.devices[1].deviceName, 'Living Room TV');
      expect(breakdown.devices[1].roomName, isNull);
    });

    test('should handle empty breakdown', () {
      final json = {
        'range': 'today',
        'devices': [],
      };

      final breakdown = EnergyBreakdown.fromJson(json);

      expect(breakdown.isEmpty, isTrue);
    });

    test('should handle camelCase field names', () {
      final json = {
        'range': 'today',
        'devices': [
          {
            'deviceId': 'abc123',
            'deviceName': 'Test Device',
            'consumption': 1.0,
            'roomName': 'Test Room',
          },
        ],
      };

      final breakdown = EnergyBreakdown.fromJson(json);

      expect(breakdown.devices[0].deviceId, 'abc123');
      expect(breakdown.devices[0].deviceName, 'Test Device');
      expect(breakdown.devices[0].roomName, 'Test Room');
    });
  });
}
