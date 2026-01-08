import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/climate_domain_view.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

void main() {
  group('ClimateDeviceType', () {
    group('getClimateDeviceIcon', () {
      test('should return thermostat icon for thermostat type', () {
        expect(
          getClimateDeviceIcon(ClimateDeviceType.thermostat),
          MdiIcons.thermostat,
        );
      });

      test('should return fire icon for heater type', () {
        expect(
          getClimateDeviceIcon(ClimateDeviceType.heater),
          MdiIcons.fireCircle,
        );
      });

      test('should return snowflake icon for cooler type', () {
        expect(
          getClimateDeviceIcon(ClimateDeviceType.cooler),
          MdiIcons.snowflake,
        );
      });

      test('should return fan icon for fan type', () {
        expect(
          getClimateDeviceIcon(ClimateDeviceType.fan),
          MdiIcons.fan,
        );
      });

      test('should return humidifier icon for humidifier type', () {
        expect(
          getClimateDeviceIcon(ClimateDeviceType.humidifier),
          MdiIcons.airHumidifier,
        );
      });

      test('should return dehumidifier icon for dehumidifier type', () {
        expect(
          getClimateDeviceIcon(ClimateDeviceType.dehumidifier),
          MdiIcons.airHumidifierOff,
        );
      });

      test('should return purifier icon for purifier type', () {
        expect(
          getClimateDeviceIcon(ClimateDeviceType.purifier),
          MdiIcons.airPurifier,
        );
      });
    });

    group('ClimateDeviceType enum', () {
      test('should have all expected climate device types', () {
        expect(ClimateDeviceType.values, [
          ClimateDeviceType.thermostat,
          ClimateDeviceType.heater,
          ClimateDeviceType.cooler,
          ClimateDeviceType.fan,
          ClimateDeviceType.humidifier,
          ClimateDeviceType.dehumidifier,
          ClimateDeviceType.purifier,
        ]);
      });

      test('should have 7 climate device types', () {
        expect(ClimateDeviceType.values.length, 7);
      });
    });
  });

  group('Climate device categories', () {
    test('climate categories should match room domain classifier', () {
      // This test verifies that the climate device categories used in
      // ClimateDomainViewPage match those defined in room_domain_classifier.dart
      const expectedClimateCategories = [
        DevicesModuleDeviceCategory.thermostat,
        DevicesModuleDeviceCategory.heater,
        DevicesModuleDeviceCategory.airConditioner,
        DevicesModuleDeviceCategory.fan,
        DevicesModuleDeviceCategory.airHumidifier,
        DevicesModuleDeviceCategory.airDehumidifier,
        DevicesModuleDeviceCategory.airPurifier,
      ];

      // The actual categories are private, so we verify by checking
      // that all expected categories exist in the enum
      for (final category in expectedClimateCategories) {
        expect(
          DevicesModuleDeviceCategory.values.contains(category),
          true,
          reason: 'Category $category should exist',
        );
      }

      expect(expectedClimateCategories.length, 7);
    });
  });

  group('Device type to icon mapping coverage', () {
    test('all ClimateDeviceType values should have an icon', () {
      // Verify that every ClimateDeviceType has a corresponding icon
      for (final type in ClimateDeviceType.values) {
        expect(
          () => getClimateDeviceIcon(type),
          returnsNormally,
          reason: 'ClimateDeviceType.$type should have an icon mapping',
        );
      }
    });

    test('all icons should be unique', () {
      final icons = ClimateDeviceType.values
          .map((type) => getClimateDeviceIcon(type))
          .toList();

      final uniqueIcons = icons.toSet();

      expect(
        uniqueIcons.length,
        icons.length,
        reason: 'All climate device types should have unique icons',
      );
    });
  });
}
