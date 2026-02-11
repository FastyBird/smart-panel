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

    test('should parse backend snake_case field names', () {
      // Actual backend response format (class-transformer @Expose names)
      final json = {
        'total_consumption_kwh': 12.45,
        'total_production_kwh': 3.21,
        'total_grid_import_kwh': 8.5,
        'total_grid_export_kwh': 1.2,
        'net_kwh': 9.24,
        'net_grid_kwh': 7.3,
        'has_grid_metrics': true,
        'range': 'today',
        'last_updated_at': '2026-02-09T12:05:00Z',
      };

      final summary = EnergySummary.fromJson(json);

      expect(summary.consumption, 12.45);
      expect(summary.production, 3.21);
      expect(summary.net, 9.24);
      expect(summary.gridImport, 8.5);
      expect(summary.gridExport, 1.2);
      expect(summary.netGrid, 7.3);
      expect(summary.hasGridMetrics, isTrue);
      expect(summary.hasProduction, isTrue);
    });

    test('should parse grid fields with defaults when absent', () {
      final json = {
        'total_consumption_kwh': 10.0,
        'range': 'today',
      };

      final summary = EnergySummary.fromJson(json);

      expect(summary.consumption, 10.0);
      expect(summary.gridImport, 0.0);
      expect(summary.gridExport, 0.0);
      expect(summary.netGrid, 0.0);
      expect(summary.hasGridMetrics, isFalse);
    });

    test('should parse backend response with no grid metrics', () {
      final json = {
        'total_consumption_kwh': 15.0,
        'total_production_kwh': 5.0,
        'total_grid_import_kwh': 0,
        'total_grid_export_kwh': 0,
        'net_kwh': 10.0,
        'net_grid_kwh': 0,
        'has_grid_metrics': false,
        'range': 'week',
      };

      final summary = EnergySummary.fromJson(json);

      expect(summary.consumption, 15.0);
      expect(summary.production, 5.0);
      expect(summary.hasGridMetrics, isFalse);
      expect(summary.gridImport, 0.0);
      expect(summary.gridExport, 0.0);
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

    test('should parse backend snake_case field names via fromList', () {
      // Actual backend response array format
      final items = [
        {
          'interval_start': '2026-02-09T12:00:00.000Z',
          'interval_end': '2026-02-09T13:00:00.000Z',
          'consumption_delta_kwh': 0.75,
          'production_delta_kwh': 0.25,
          'grid_import_delta_kwh': 0.5,
          'grid_export_delta_kwh': 0.1,
        },
        {
          'interval_start': '2026-02-09T13:00:00.000Z',
          'interval_end': '2026-02-09T14:00:00.000Z',
          'consumption_delta_kwh': 1.0,
          'production_delta_kwh': 0.0,
          'grid_import_delta_kwh': 0.8,
          'grid_export_delta_kwh': 0.0,
        },
      ];

      final timeseries = EnergyTimeseries.fromList(
        items.cast<Map<String, dynamic>>(),
        range: 'today',
        interval: '1h',
      );

      expect(timeseries.range, 'today');
      expect(timeseries.interval, '1h');
      expect(timeseries.points.length, 2);
      expect(timeseries.points[0].consumption, 0.75);
      expect(timeseries.points[0].production, 0.25);
      expect(timeseries.points[0].gridImport, 0.5);
      expect(timeseries.points[0].gridExport, 0.1);
      expect(timeseries.points[0].timestamp, DateTime.parse('2026-02-09T12:00:00.000Z'));
      expect(timeseries.points[1].consumption, 1.0);
      expect(timeseries.points[1].gridImport, 0.8);
    });

    test('should parse interval_start as timestamp in fromJson point', () {
      final json = {
        'range': 'today',
        'interval': '1h',
        'series': [
          {
            'interval_start': '2026-02-09T12:00:00.000Z',
            'consumption_delta_kwh': 0.5,
            'production_delta_kwh': 0.0,
            'grid_import_delta_kwh': 0.3,
            'grid_export_delta_kwh': 0.0,
          },
        ],
      };

      final timeseries = EnergyTimeseries.fromJson(json);

      expect(timeseries.points.length, 1);
      expect(timeseries.points[0].timestamp, DateTime.parse('2026-02-09T12:00:00.000Z'));
      expect(timeseries.points[0].consumption, 0.5);
      expect(timeseries.points[0].gridImport, 0.3);
    });

    test('should default grid fields to 0 when absent', () {
      final items = [
        {
          'interval_start': '2026-02-09T12:00:00.000Z',
          'consumption_delta_kwh': 1.0,
          'production_delta_kwh': 0.0,
        },
      ];

      final timeseries = EnergyTimeseries.fromList(
        items.cast<Map<String, dynamic>>(),
        range: 'today',
        interval: '1h',
      );

      expect(timeseries.points[0].gridImport, 0.0);
      expect(timeseries.points[0].gridExport, 0.0);
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

    test('should parse backend snake_case response via fromList', () {
      // Actual backend response array format
      final items = [
        {
          'device_id': 'abc-123',
          'device_name': 'Washing Machine',
          'room_id': 'room-1',
          'room_name': 'Laundry',
          'consumption_kwh': 5.2,
        },
        {
          'device_id': 'def-456',
          'device_name': 'Dishwasher',
          'room_id': null,
          'room_name': null,
          'consumption_kwh': 3.1,
        },
      ];

      final breakdown = EnergyBreakdown.fromList(
        items.cast<Map<String, dynamic>>(),
        range: 'today',
      );

      expect(breakdown.range, 'today');
      expect(breakdown.devices.length, 2);
      expect(breakdown.devices[0].deviceId, 'abc-123');
      expect(breakdown.devices[0].deviceName, 'Washing Machine');
      expect(breakdown.devices[0].consumption, 5.2);
      expect(breakdown.devices[0].roomName, 'Laundry');
      expect(breakdown.devices[1].deviceName, 'Dishwasher');
      expect(breakdown.devices[1].roomName, isNull);
    });

    test('should parse consumption_kwh from backend response', () {
      final json = {
        'range': 'today',
        'devices': [
          {
            'device_id': 'abc123',
            'device_name': 'Test Device',
            'consumption_kwh': 7.5,
          },
        ],
      };

      final breakdown = EnergyBreakdown.fromJson(json);

      expect(breakdown.devices[0].consumption, 7.5);
    });
  });
}
