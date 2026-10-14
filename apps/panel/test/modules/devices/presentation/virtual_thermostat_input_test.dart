import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_input.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime.utc(2026, 10, 14, 12);
  test(
    'ages a fresh unchanged sample and expires it without another response',
    () {
      final input = VirtualThermostatInput.fromJson({
        'binding': 'ambient',
        'role': 'ambient',
        'status': 'fresh',
        'quality': 'good',
        'source_kind': 'physical',
        'sampled_at': now
            .subtract(const Duration(seconds: 59))
            .toIso8601String(),
        'age_seconds': 59,
        'maximum_age_seconds': 60,
      });
      expect(input.currentStatus(Duration.zero, now), 'fresh');
      expect(input.currentStatus(const Duration(seconds: 2), now), 'stale');
      expect(input.age(const Duration(seconds: 2)), 61);
    },
  );
  test(
    'keeps stale, missing, unavailable and incompatible inputs distinct',
    () {
      for (final status in [
        'stale',
        'missing',
        'unavailable',
        'incompatible',
      ]) {
        final input = VirtualThermostatInput.fromJson({'status': status});
        expect(input.currentStatus(Duration.zero, now), status);
        expect(input.age(Duration.zero), isNull);
      }
    },
  );
  test(
    'rejects incomplete freshness and respects the earlier derived expiry',
    () {
      final incomplete = VirtualThermostatInput.fromJson({'status': 'fresh'});
      expect(incomplete.currentStatus(Duration.zero, now), 'unavailable');
      final unknownQuality = VirtualThermostatInput.fromJson({
        'status': 'fresh',
        'quality': 'unknown-quality',
        'age_seconds': 1,
        'maximum_age_seconds': 60,
      });
      expect(unknownQuality.currentStatus(Duration.zero, now), 'unavailable');
      final derived = VirtualThermostatInput.fromJson({
        'status': 'fresh',
        'quality': 'degraded',
        'source_kind': 'derived',
        'age_seconds': 1,
        'maximum_age_seconds': 60,
        'expires_at': now.toIso8601String(),
      });
      expect(derived.currentStatus(Duration.zero, now), 'stale');
    },
  );
}
