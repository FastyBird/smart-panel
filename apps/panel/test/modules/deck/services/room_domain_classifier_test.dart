import 'package:fastybird_smart_panel/modules/deck/services/room_domain_classifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('classifyDeviceToDomain', () {
    group('LIGHTS domain', () {
      test('should classify lighting to lights domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.lighting),
          DomainType.lights,
        );
      });
    });

    group('CLIMATE domain', () {
      test('should classify thermostat to climate domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.thermostat),
          DomainType.climate,
        );
      });

      test('should classify heater to climate domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.heater),
          DomainType.climate,
        );
      });

      test('should classify airConditioner to climate domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.airConditioner),
          DomainType.climate,
        );
      });

      test('should classify fan to climate domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.fan),
          DomainType.climate,
        );
      });

      test('should classify airHumidifier to climate domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.airHumidifier),
          DomainType.climate,
        );
      });

      test('should classify airDehumidifier to climate domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.airDehumidifier),
          DomainType.climate,
        );
      });

      test('should classify airPurifier to climate domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.airPurifier),
          DomainType.climate,
        );
      });
    });

    group('MEDIA domain', () {
      test('should classify television to media domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.television),
          DomainType.media,
        );
      });

      test('should classify media to media domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.media),
          DomainType.media,
        );
      });

      test('should classify speaker to media domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.speaker),
          DomainType.media,
        );
      });
    });

    group('SENSORS domain', () {
      test('should classify sensor to sensors domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.sensor),
          DomainType.sensors,
        );
      });

      test('should classify camera to sensors domain', () {
        expect(
          classifyDeviceToDomain(DeviceCategory.camera),
          DomainType.sensors,
        );
      });
    });

    group('unclassified categories', () {
      test('should return null for generic', () {
        expect(classifyDeviceToDomain(DeviceCategory.generic), isNull);
      });

      test('should return null for alarm', () {
        expect(classifyDeviceToDomain(DeviceCategory.alarm), isNull);
      });

      test('should return null for door', () {
        expect(classifyDeviceToDomain(DeviceCategory.door), isNull);
      });

      test('should return null for doorbell', () {
        expect(classifyDeviceToDomain(DeviceCategory.doorbell), isNull);
      });

      test('should return null for lock', () {
        expect(classifyDeviceToDomain(DeviceCategory.lock), isNull);
      });

      test('should return null for outlet', () {
        expect(classifyDeviceToDomain(DeviceCategory.outlet), isNull);
      });

      test('should return null for switcher', () {
        expect(classifyDeviceToDomain(DeviceCategory.switcher), isNull);
      });

      test('should return null for windowCovering', () {
        expect(classifyDeviceToDomain(DeviceCategory.windowCovering), isNull);
      });
    });
  });

  group('DomainCounts', () {
    test('should have zero counts by default', () {
      const counts = DomainCounts();

      expect(counts.lights, 0);
      expect(counts.climate, 0);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
      expect(counts.total, 0);
    });

    test('getCount should return correct values', () {
      const counts = DomainCounts(
        lights: 3,
        climate: 2,
        media: 1,
        sensors: 4,
      );

      expect(counts.getCount(DomainType.lights), 3);
      expect(counts.getCount(DomainType.climate), 2);
      expect(counts.getCount(DomainType.media), 1);
      expect(counts.getCount(DomainType.sensors), 4);
    });

    test('hasDomain should return true for non-zero counts', () {
      const counts = DomainCounts(lights: 1, climate: 0);

      expect(counts.hasDomain(DomainType.lights), true);
      expect(counts.hasDomain(DomainType.climate), false);
    });

    test('hasAnyDomain should return true if any domain has devices', () {
      const countsWithDevices = DomainCounts(lights: 1);
      const countsEmpty = DomainCounts();

      expect(countsWithDevices.hasAnyDomain, true);
      expect(countsEmpty.hasAnyDomain, false);
    });

    test('presentDomains should return only domains with count > 0', () {
      const counts = DomainCounts(
        lights: 2,
        climate: 0,
        media: 3,
        sensors: 0,
      );

      final present = counts.presentDomains;

      expect(present.length, 2);
      expect(present.contains(DomainType.lights), true);
      expect(present.contains(DomainType.media), true);
      expect(present.contains(DomainType.climate), false);
      expect(present.contains(DomainType.sensors), false);
    });

    test('presentDomains should be sorted by displayOrder', () {
      const counts = DomainCounts(
        lights: 1,
        climate: 1,
        media: 1,
        sensors: 1,
      );

      final present = counts.presentDomains;

      // Should be in order: lights (0), climate (1), media (2), sensors (3)
      expect(present[0], DomainType.lights);
      expect(present[1], DomainType.climate);
      expect(present[2], DomainType.media);
      expect(present[3], DomainType.sensors);
    });

    test('total should sum all counts', () {
      const counts = DomainCounts(
        lights: 3,
        climate: 2,
        media: 1,
        sensors: 4,
      );

      expect(counts.total, 10);
    });
  });

  group('buildDomainCounts', () {
    test('should return empty counts for empty list', () {
      final counts = buildDomainCounts([]);

      expect(counts.lights, 0);
      expect(counts.climate, 0);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
    });

    test('should count lighting devices', () {
      final categories = [
        DeviceCategory.lighting,
        DeviceCategory.lighting,
        DeviceCategory.lighting,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.lights, 3);
      expect(counts.climate, 0);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
    });

    test('should count climate devices', () {
      final categories = [
        DeviceCategory.thermostat,
        DeviceCategory.heater,
        DeviceCategory.airConditioner,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.lights, 0);
      expect(counts.climate, 3);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
    });

    test('should count mixed device categories', () {
      final categories = [
        DeviceCategory.lighting,
        DeviceCategory.thermostat,
        DeviceCategory.television,
        DeviceCategory.sensor,
        DeviceCategory.lighting,
        DeviceCategory.outlet, // Not classified
        DeviceCategory.camera,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.lights, 2);
      expect(counts.climate, 1);
      expect(counts.media, 1);
      expect(counts.sensors, 2);
      expect(counts.total, 6); // outlet not counted
    });

    test('should ignore unclassified categories', () {
      final categories = [
        DeviceCategory.generic,
        DeviceCategory.outlet,
        DeviceCategory.switcher,
        DeviceCategory.door,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.total, 0);
      expect(counts.hasAnyDomain, false);
    });
  });
}
