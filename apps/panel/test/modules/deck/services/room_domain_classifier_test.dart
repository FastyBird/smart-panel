import 'package:fastybird_smart_panel/modules/deck/services/room_domain_classifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('classifyDeviceToDomain', () {
    group('LIGHTS domain', () {
      test('should classify lighting to lights domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.lighting),
          DomainType.lights,
        );
      });
    });

    group('CLIMATE domain', () {
      test('should classify thermostat to climate domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.thermostat),
          DomainType.climate,
        );
      });

      test('should classify heatingUnit to climate domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.heatingUnit),
          DomainType.climate,
        );
      });

      test('should classify airConditioner to climate domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.airConditioner),
          DomainType.climate,
        );
      });

      test('should classify fan to climate domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.fan),
          DomainType.climate,
        );
      });

      test('should classify airHumidifier to climate domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.airHumidifier),
          DomainType.climate,
        );
      });

      test('should classify airDehumidifier to climate domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.airDehumidifier),
          DomainType.climate,
        );
      });

      test('should classify airPurifier to climate domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.airPurifier),
          DomainType.climate,
        );
      });
    });

    group('MEDIA domain', () {
      test('should classify television to media domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.television),
          DomainType.media,
        );
      });

      test('should classify media to media domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.media),
          DomainType.media,
        );
      });

      test('should classify speaker to media domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.speaker),
          DomainType.media,
        );
      });
    });

    group('SENSORS domain', () {
      test('should classify sensor to sensors domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.sensor),
          DomainType.sensors,
        );
      });

      test('should classify camera to sensors domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.camera),
          DomainType.sensors,
        );
      });
    });

    group('SHADING domain', () {
      test('should classify windowCovering to shading domain', () {
        expect(
          classifyDeviceToDomain(DevicesModuleDeviceCategory.windowCovering),
          DomainType.shading,
        );
      });
    });

    group('unclassified categories', () {
      test('should return null for generic', () {
        expect(classifyDeviceToDomain(DevicesModuleDeviceCategory.generic), isNull);
      });

      test('should return null for alarm', () {
        expect(classifyDeviceToDomain(DevicesModuleDeviceCategory.alarm), isNull);
      });

      test('should return null for door', () {
        expect(classifyDeviceToDomain(DevicesModuleDeviceCategory.door), isNull);
      });

      test('should return null for doorbell', () {
        expect(classifyDeviceToDomain(DevicesModuleDeviceCategory.doorbell), isNull);
      });

      test('should return null for lock', () {
        expect(classifyDeviceToDomain(DevicesModuleDeviceCategory.lock), isNull);
      });

      test('should return null for outlet', () {
        expect(classifyDeviceToDomain(DevicesModuleDeviceCategory.outlet), isNull);
      });

      test('should return null for switcher', () {
        expect(classifyDeviceToDomain(DevicesModuleDeviceCategory.switcher), isNull);
      });
    });
  });

  group('DomainCounts', () {
    test('should have zero counts by default', () {
      const counts = DomainCounts();

      expect(counts.lights, 0);
      expect(counts.climate, 0);
      expect(counts.shading, 0);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
      expect(counts.total, 0);
    });

    test('getCount should return correct values', () {
      const counts = DomainCounts(
        lights: 3,
        climate: 2,
        shading: 5,
        media: 1,
        sensors: 4,
      );

      expect(counts.getCount(DomainType.lights), 3);
      expect(counts.getCount(DomainType.climate), 2);
      expect(counts.getCount(DomainType.shading), 5);
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
        climateActuators: 1,
        shading: 1,
        media: 1,
        sensors: 1,
      );

      final present = counts.presentDomains;

      // Should be in order: lights (0), climate (1), shading (2), media (3), sensors (4), energy (5)
      expect(present[0], DomainType.lights);
      expect(present[1], DomainType.climate);
      expect(present[2], DomainType.shading);
      expect(present[3], DomainType.media);
      expect(present[4], DomainType.sensors);
      expect(present[5], DomainType.energy);
    });

    test('total should sum all counts', () {
      const counts = DomainCounts(
        lights: 3,
        climate: 2,
        shading: 5,
        media: 1,
        sensors: 4,
      );

      expect(counts.total, 15);
    });
  });

  group('buildDomainCounts', () {
    test('should return empty counts for empty list', () {
      final counts = buildDomainCounts([]);

      expect(counts.lights, 0);
      expect(counts.climate, 0);
      expect(counts.shading, 0);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
    });

    test('should count lighting devices', () {
      final categories = [
        DevicesModuleDeviceCategory.lighting,
        DevicesModuleDeviceCategory.lighting,
        DevicesModuleDeviceCategory.lighting,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.lights, 3);
      expect(counts.climate, 0);
      expect(counts.shading, 0);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
    });

    test('should count climate devices', () {
      final categories = [
        DevicesModuleDeviceCategory.thermostat,
        DevicesModuleDeviceCategory.heatingUnit,
        DevicesModuleDeviceCategory.airConditioner,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.lights, 0);
      expect(counts.climate, 3);
      expect(counts.shading, 0);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
    });

    test('should count shading devices', () {
      final categories = [
        DevicesModuleDeviceCategory.windowCovering,
        DevicesModuleDeviceCategory.windowCovering,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.lights, 0);
      expect(counts.climate, 0);
      expect(counts.shading, 2);
      expect(counts.media, 0);
      expect(counts.sensors, 0);
    });

    test('should count mixed device categories', () {
      final categories = [
        DevicesModuleDeviceCategory.lighting,
        DevicesModuleDeviceCategory.thermostat,
        DevicesModuleDeviceCategory.television,
        DevicesModuleDeviceCategory.sensor,
        DevicesModuleDeviceCategory.lighting,
        DevicesModuleDeviceCategory.outlet, // Not classified
        DevicesModuleDeviceCategory.camera,
        DevicesModuleDeviceCategory.windowCovering,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.lights, 2);
      expect(counts.climate, 1);
      expect(counts.shading, 1);
      expect(counts.media, 1);
      expect(counts.sensors, 2);
      expect(counts.total, 7); // outlet not counted
    });

    test('should ignore unclassified categories', () {
      final categories = [
        DevicesModuleDeviceCategory.generic,
        DevicesModuleDeviceCategory.outlet,
        DevicesModuleDeviceCategory.switcher,
        DevicesModuleDeviceCategory.door,
      ];

      final counts = buildDomainCounts(categories);

      expect(counts.total, 0);
      expect(counts.hasAnyDomain, false);
    });
  });
}
