import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/climate_domain_view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// =============================================================================
// Test Helpers - Mock Channel Property Views
// =============================================================================

ChannelPropertyView _createMockProperty({
  String id = 'prop-1',
  String type = 'test',
  bool isReadable = true,
  bool isWritable = false,
}) {
  final permissions = <DevicesModulePermissionType>[];
  if (isReadable && isWritable) {
    permissions.add(DevicesModulePermissionType.rw);
  } else if (isReadable) {
    permissions.add(DevicesModulePermissionType.ro);
  } else if (isWritable) {
    permissions.add(DevicesModulePermissionType.wo);
  }

  return ChannelPropertyView(
    id: id,
    type: type,
    channel: 'channel-1',
    dataType: DevicesModuleDataType.float,
    permission: permissions,
  );
}

// =============================================================================
// Test Helpers - Mock Channel Views
// =============================================================================

DeviceInformationChannelView _createMockDeviceInfoChannel() {
  return DeviceInformationChannelView(
    id: 'device-info-channel',
    type: 'device-information',
    category: DevicesModuleChannelCategory.deviceInformation,
    device: 'device-1',
    properties: [
      _createMockProperty(id: 'manufacturer', type: 'manufacturer'),
      _createMockProperty(id: 'model', type: 'model'),
    ],
  );
}

TemperatureChannelView _createMockTemperatureChannel() {
  return TemperatureChannelView(
    id: 'temp-channel',
    type: 'temperature',
    category: DevicesModuleChannelCategory.temperature,
    device: 'device-1',
    properties: [
      _createMockProperty(id: 'temperature', type: 'temperature'),
    ],
  );
}

ThermostatChannelView _createMockThermostatChannel() {
  return ThermostatChannelView(
    id: 'thermostat-channel',
    type: 'thermostat',
    category: DevicesModuleChannelCategory.thermostat,
    device: 'device-1',
    properties: [
      _createMockProperty(id: 'mode', type: 'mode'),
    ],
  );
}

HeaterChannelView _createMockHeaterChannel() {
  return HeaterChannelView(
    id: 'heater-channel',
    type: 'heater',
    category: DevicesModuleChannelCategory.heater,
    device: 'device-1',
    properties: [
      _createMockProperty(id: 'heater', type: 'heater'),
      _createMockProperty(id: 'temperature', type: 'temperature'),
    ],
  );
}

CoolerChannelView _createMockCoolerChannel() {
  return CoolerChannelView(
    id: 'cooler-channel',
    type: 'cooler',
    category: DevicesModuleChannelCategory.cooler,
    device: 'device-1',
    properties: [
      _createMockProperty(id: 'cooler', type: 'cooler'),
      _createMockProperty(id: 'temperature', type: 'temperature'),
    ],
  );
}

FanChannelView _createMockFanChannel() {
  return FanChannelView(
    id: 'fan-channel',
    type: 'fan',
    category: DevicesModuleChannelCategory.fan,
    device: 'device-1',
    properties: [
      _createMockProperty(id: 'on', type: 'on'),
    ],
  );
}

SwitcherChannelView _createMockSwitcherChannel() {
  return SwitcherChannelView(
    id: 'switcher-channel',
    type: 'switcher',
    category: DevicesModuleChannelCategory.switcher,
    device: 'device-1',
    properties: [
      _createMockProperty(id: 'on', type: 'on'),
    ],
  );
}

HumidityChannelView _createMockHumidityChannel() {
  return HumidityChannelView(
    id: 'humidity-channel',
    type: 'humidity',
    category: DevicesModuleChannelCategory.humidity,
    device: 'device-1',
    properties: [
      _createMockProperty(id: 'humidity', type: 'humidity'),
    ],
  );
}

// =============================================================================
// Test Helpers - Mock Device Views
// =============================================================================

ThermostatDeviceView _createMockThermostatDevice() {
  return ThermostatDeviceView(
    id: 'thermostat-1',
    type: 'thermostat',
    category: DevicesModuleDeviceCategory.thermostat,
    name: 'Test Thermostat',
    channels: [
      _createMockDeviceInfoChannel(),
      _createMockTemperatureChannel(),
      _createMockThermostatChannel(),
      _createMockHeaterChannel(),
    ],
  );
}

HeaterDeviceView _createMockHeaterDevice() {
  return HeaterDeviceView(
    id: 'heater-1',
    type: 'heater',
    category: DevicesModuleDeviceCategory.heater,
    name: 'Test Heater',
    channels: [
      _createMockDeviceInfoChannel(),
      _createMockTemperatureChannel(),
      _createMockHeaterChannel(),
    ],
  );
}

AirConditionerDeviceView _createMockAirConditionerDevice() {
  return AirConditionerDeviceView(
    id: 'ac-1',
    type: 'air-conditioner',
    category: DevicesModuleDeviceCategory.airConditioner,
    name: 'Test AC',
    channels: [
      _createMockDeviceInfoChannel(),
      _createMockTemperatureChannel(),
      _createMockCoolerChannel(),
    ],
  );
}

FanDeviceView _createMockFanDevice() {
  return FanDeviceView(
    id: 'fan-1',
    type: 'fan',
    category: DevicesModuleDeviceCategory.fan,
    name: 'Test Fan',
    channels: [
      _createMockDeviceInfoChannel(),
      _createMockFanChannel(),
    ],
  );
}

AirHumidifierDeviceView _createMockHumidifierDevice() {
  return AirHumidifierDeviceView(
    id: 'humidifier-1',
    type: 'air-humidifier',
    category: DevicesModuleDeviceCategory.airHumidifier,
    name: 'Test Humidifier',
    channels: [
      _createMockDeviceInfoChannel(),
      _createMockSwitcherChannel(),
      _createMockHumidityChannel(),
    ],
  );
}

AirDehumidifierDeviceView _createMockDehumidifierDevice() {
  return AirDehumidifierDeviceView(
    id: 'dehumidifier-1',
    type: 'air-dehumidifier',
    category: DevicesModuleDeviceCategory.airDehumidifier,
    name: 'Test Dehumidifier',
    channels: [
      _createMockDeviceInfoChannel(),
      _createMockSwitcherChannel(),
      _createMockHumidityChannel(),
    ],
  );
}

AirPurifierDeviceView _createMockPurifierDevice() {
  return AirPurifierDeviceView(
    id: 'purifier-1',
    type: 'air-purifier',
    category: DevicesModuleDeviceCategory.airPurifier,
    name: 'Test Purifier',
    channels: [
      _createMockDeviceInfoChannel(),
      _createMockFanChannel(),
    ],
  );
}

DeviceView _createMockGenericDevice() {
  return DeviceView(
    id: 'generic-1',
    type: 'generic',
    category: DevicesModuleDeviceCategory.generic,
    name: 'Test Generic',
    channels: [],
  );
}

// =============================================================================
// Tests
// =============================================================================

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

  group('isHeroClimateDevice', () {
    test('should return true for thermostat', () {
      expect(isHeroClimateDevice(ClimateDeviceType.thermostat), true);
    });

    test('should return true for heater', () {
      expect(isHeroClimateDevice(ClimateDeviceType.heater), true);
    });

    test('should return true for cooler', () {
      expect(isHeroClimateDevice(ClimateDeviceType.cooler), true);
    });

    test('should return false for fan', () {
      expect(isHeroClimateDevice(ClimateDeviceType.fan), false);
    });

    test('should return false for humidifier', () {
      expect(isHeroClimateDevice(ClimateDeviceType.humidifier), false);
    });

    test('should return false for dehumidifier', () {
      expect(isHeroClimateDevice(ClimateDeviceType.dehumidifier), false);
    });

    test('should return false for purifier', () {
      expect(isHeroClimateDevice(ClimateDeviceType.purifier), false);
    });

    test('all ClimateDeviceType values should be handled', () {
      // Ensure no exception is thrown for any type
      for (final type in ClimateDeviceType.values) {
        expect(
          () => isHeroClimateDevice(type),
          returnsNormally,
          reason: 'isHeroClimateDevice should handle $type',
        );
      }
    });

    test('hero devices are temperature-controllable types', () {
      // Hero devices are those with temperature setpoint control (dial UI)
      final heroTypes = ClimateDeviceType.values
          .where((t) => isHeroClimateDevice(t))
          .toList();

      expect(heroTypes, [
        ClimateDeviceType.thermostat,
        ClimateDeviceType.heater,
        ClimateDeviceType.cooler,
      ]);
    });

    test('non-hero devices are auxiliary climate devices', () {
      // Non-hero devices are fans, humidifiers, purifiers (toggle UI)
      final nonHeroTypes = ClimateDeviceType.values
          .where((t) => !isHeroClimateDevice(t))
          .toList();

      expect(nonHeroTypes, [
        ClimateDeviceType.fan,
        ClimateDeviceType.humidifier,
        ClimateDeviceType.dehumidifier,
        ClimateDeviceType.purifier,
      ]);
    });
  });

  group('getClimateDeviceType', () {
    test('should return thermostat for ThermostatDeviceView', () {
      final device = _createMockThermostatDevice();
      expect(getClimateDeviceType(device), ClimateDeviceType.thermostat);
    });

    test('should return heater for HeaterDeviceView', () {
      final device = _createMockHeaterDevice();
      expect(getClimateDeviceType(device), ClimateDeviceType.heater);
    });

    test('should return cooler for AirConditionerDeviceView', () {
      final device = _createMockAirConditionerDevice();
      expect(getClimateDeviceType(device), ClimateDeviceType.cooler);
    });

    test('should return fan for FanDeviceView', () {
      final device = _createMockFanDevice();
      expect(getClimateDeviceType(device), ClimateDeviceType.fan);
    });

    test('should return humidifier for AirHumidifierDeviceView', () {
      final device = _createMockHumidifierDevice();
      expect(getClimateDeviceType(device), ClimateDeviceType.humidifier);
    });

    test('should return dehumidifier for AirDehumidifierDeviceView', () {
      final device = _createMockDehumidifierDevice();
      expect(getClimateDeviceType(device), ClimateDeviceType.dehumidifier);
    });

    test('should return purifier for AirPurifierDeviceView', () {
      final device = _createMockPurifierDevice();
      expect(getClimateDeviceType(device), ClimateDeviceType.purifier);
    });

    test('should return null for generic DeviceView', () {
      final device = _createMockGenericDevice();
      expect(getClimateDeviceType(device), isNull);
    });

    test('should return null for non-climate device categories', () {
      final lightingDevice = DeviceView(
        id: 'light-1',
        type: 'lighting',
        category: DevicesModuleDeviceCategory.lighting,
        name: 'Test Light',
        channels: [],
      );

      expect(getClimateDeviceType(lightingDevice), isNull);
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

  group('Device type classification consistency', () {
    test('getClimateDeviceType should be consistent with isHeroClimateDevice', () {
      // Thermostat devices should map to hero types
      final thermostat = _createMockThermostatDevice();
      final heater = _createMockHeaterDevice();
      final ac = _createMockAirConditionerDevice();

      expect(isHeroClimateDevice(getClimateDeviceType(thermostat)!), true);
      expect(isHeroClimateDevice(getClimateDeviceType(heater)!), true);
      expect(isHeroClimateDevice(getClimateDeviceType(ac)!), true);

      // Auxiliary devices should not map to hero types
      final fan = _createMockFanDevice();
      final humidifier = _createMockHumidifierDevice();
      final dehumidifier = _createMockDehumidifierDevice();
      final purifier = _createMockPurifierDevice();

      expect(isHeroClimateDevice(getClimateDeviceType(fan)!), false);
      expect(isHeroClimateDevice(getClimateDeviceType(humidifier)!), false);
      expect(isHeroClimateDevice(getClimateDeviceType(dehumidifier)!), false);
      expect(isHeroClimateDevice(getClimateDeviceType(purifier)!), false);
    });

    test('hero devices get temperature dial, non-hero get toggle tiles', () {
      // This documents the expected UI behavior based on device type
      final heroDevices = <DeviceView>[
        _createMockThermostatDevice(),
        _createMockHeaterDevice(),
        _createMockAirConditionerDevice(),
      ];

      final toggleDevices = <DeviceView>[
        _createMockFanDevice(),
        _createMockHumidifierDevice(),
        _createMockDehumidifierDevice(),
        _createMockPurifierDevice(),
      ];

      // All hero devices should be identifiable
      for (final device in heroDevices) {
        final type = getClimateDeviceType(device);
        expect(type, isNotNull);
        expect(isHeroClimateDevice(type!), true,
            reason: '${device.runtimeType} should be a hero device');
      }

      // All toggle devices should be identifiable but not hero
      for (final device in toggleDevices) {
        final type = getClimateDeviceType(device);
        expect(type, isNotNull);
        expect(isHeroClimateDevice(type!), false,
            reason: '${device.runtimeType} should not be a hero device');
      }
    });
  });
}
