import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:yaml/yaml.dart';

/// Test that validates channel view implementations match the spec.
///
/// This test reads the channel spec YAML and verifies that:
/// - Properties marked as `required: true` use `.first` (non-nullable)
/// - Properties marked as `required: false` use `.firstOrNull` (nullable)
void main() {
  group('Channel Views Spec Validation', () {
    late Map<String, dynamic> channelsSpec;
    late String viewsBasePath;

    setUpAll(() {
      // Find the project root by looking for the spec directory
      final currentDir = Directory.current.path;
      String projectRoot;

      if (currentDir.contains('apps/panel')) {
        // Running from within apps/panel
        projectRoot = currentDir.replaceAll(RegExp(r'/apps/panel.*'), '');
      } else {
        projectRoot = currentDir;
      }

      final specFile = File('$projectRoot/spec/devices/channels.yaml');
      expect(specFile.existsSync(), isTrue,
          reason: 'channels.yaml spec file should exist at ${specFile.path}');

      final specContent = specFile.readAsStringSync();
      final yamlData = loadYaml(specContent) as YamlMap;
      channelsSpec = _yamlToMap(yamlData);

      viewsBasePath =
          '$projectRoot/apps/panel/lib/modules/devices/views/channels';
    });

    /// Map of channel category to Dart file name
    /// Some channels have different file names than their category
    Map<String, String> getChannelFileMapping() {
      return {
        'air_particulate': 'air_particulate',
        'air_quality': 'air_quality',
        'alarm': 'alarm',
        'battery': 'battery',
        'camera': 'camera',
        'carbon_dioxide': 'carbon_dioxide',
        'carbon_monoxide': 'carbon_monoxide',
        'contact': 'contact',
        'cooler': 'cooler',
        'dehumidifier': 'dehumidifier',
        'device_information': 'device_information',
        'door': 'door',
        'doorbell': 'doorbell',
        'electrical_energy': 'electrical_energy',
        'electrical_power': 'electrical_power',
        'fan': 'fan',
        'filter': 'filter',
        'flow': 'flow',
        'gas': 'gas',
        'heater': 'heater',
        'humidity': 'humidity',
        'humidifier': 'humidifier',
        'illuminance': 'illuminance',
        'leak': 'leak',
        'light': 'light',
        'lock': 'lock',
        'media_input': 'media_input',
        'media_playback': 'media_playback',
        'microphone': 'microphone',
        'motion': 'motion',
        'nitrogen_dioxide': 'nitrogen_dioxide',
        'occupancy': 'occupancy',
        'outlet': 'outlet',
        'ozone': 'ozone',
        'pressure': 'pressure',
        'robot_vacuum': 'robot_vacuum',
        'smoke': 'smoke',
        'speaker': 'speaker',
        'sulphur_dioxide': 'sulphur_dioxide',
        'switcher': 'switcher',
        'television': 'television',
        'temperature': 'temperature',
        'thermostat': 'thermostat',
        'valve': 'valve',
        'volatile_organic_compounds': 'volatile_organic_compounds',
        'window_covering': 'window_covering',
      };
    }

    /// Map of property category to expected Dart property view class pattern
    Map<String, String> getPropertyClassPatterns() {
      return {
        'active': 'ActiveChannelPropertyView',
        'angle': 'AngleChannelPropertyView',
        'aqi': 'AqiChannelPropertyView',
        'brightness': 'BrightnessChannelPropertyView',
        'change_needed': 'ChangeNeededChannelPropertyView',
        'child_lock': 'ChildLockChannelPropertyView',
        'color_blue': 'ColorBlueChannelPropertyView',
        'color_green': 'ColorGreenChannelPropertyView',
        'color_red': 'ColorRedChannelPropertyView',
        'color_temperature': 'ColorTemperatureChannelPropertyView',
        'color_white': 'ColorWhiteChannelPropertyView',
        'command': 'CommandChannelPropertyView',
        'connection_type': 'ConnectionTypeChannelPropertyView',
        'consumption': 'ConsumptionChannelPropertyView',
        'current': 'CurrentChannelPropertyView',
        'defrost_active': 'DefrostActiveChannelPropertyView',
        'concentration': 'ConcentrationChannelPropertyView',
        'detected': 'DetectedChannelPropertyView',
        'direction': 'DirectionChannelPropertyView',
        'distance': 'DistanceChannelPropertyView',
        'duration': 'DurationChannelPropertyView',
        'event': 'EventChannelPropertyView',
        'fault': 'FaultChannelPropertyView',
        'firmware_revision': 'FirmwareRevisionChannelPropertyView',
        'frequency': 'FrequencyChannelPropertyView',
        'hardware_revision': 'HardwareRevisionChannelPropertyView',
        'hue': 'HueChannelPropertyView',
        'humidity': 'HumidityChannelPropertyView',
        'in_use': 'InUseChannelPropertyView',
        'infrared': 'InfraredChannelPropertyView',
        'illuminance': 'IlluminanceChannelPropertyView',
        'level': 'LevelChannelPropertyView',
        'life_remaining': 'LifeRemainingChannelPropertyView',
        'link_quality': 'LinkQualityChannelPropertyView',
        'locked': 'LockedChannelPropertyView',
        'manufacturer': 'ManufacturerChannelPropertyView',
        'pressure': 'PressureChannelPropertyView',
        'mist_level': 'MistLevelChannelPropertyView',
        'mode': 'ModeChannelPropertyView',
        'model': 'ModelChannelPropertyView',
        'natural_breeze': 'NaturalBreezeChannelPropertyView',
        'obstruction': 'ObstructionChannelPropertyView',
        'on': 'OnChannelPropertyView',
        'over_current': 'OverCurrentChannelPropertyView',
        'over_power': 'OverPowerChannelPropertyView',
        'over_voltage': 'OverVoltageChannelPropertyView',
        'pan': 'PanChannelPropertyView',
        'peak_level': 'PeakLevelChannelPropertyView',
        'percentage': 'PercentageChannelPropertyView',
        'position': 'PositionChannelPropertyView',
        'power': 'PowerChannelPropertyView',
        'rate': 'RateChannelPropertyView',
        'remaining': 'RemainingChannelPropertyView',
        'remote_key': 'RemoteKeyChannelPropertyView',
        'reset': 'ResetChannelPropertyView',
        'saturation': 'SaturationChannelPropertyView',
        'serial_number': 'SerialNumberChannelPropertyView',
        'siren': 'SirenChannelPropertyView',
        'source': 'SourceChannelPropertyView',
        'speed': 'SpeedChannelPropertyView',
        'state': 'StateChannelPropertyView',
        'status': 'StatusChannelPropertyView',
        'swing': 'SwingChannelPropertyView',
        'tampered': 'TamperedChannelPropertyView',
        'temperature': 'TemperatureChannelPropertyView',
        'tilt': 'TiltChannelPropertyView',
        'timer': 'TimerChannelPropertyView',
        'track': 'TrackChannelPropertyView',
        'triggered': 'TriggeredChannelPropertyView',
        'type': 'TypeChannelPropertyView',
        'units': 'UnitsChannelPropertyView',
        'voltage': 'VoltageChannelPropertyView',
        'volume': 'VolumeChannelPropertyView',
        'warm_mist': 'WarmMistChannelPropertyView',
        'water_tank_empty': 'WaterTankEmptyChannelPropertyView',
        'water_tank_full': 'WaterTankFullChannelPropertyView',
        'water_tank_level': 'WaterTankLevelChannelPropertyView',
        'zoom': 'ZoomChannelPropertyView',
      };
    }

    /// Parse a Dart file and extract property accessor definitions
    /// Returns a map of property class name to whether it's nullable (uses firstOrNull)
    Map<String, bool> parsePropertyAccessors(String content) {
      final accessors = <String, bool>{};

      // Pattern to match property accessors like:
      // SomePropertyView? get someProp => properties.whereType<SomePropertyView>().firstOrNull;
      // SomePropertyView get someProp => properties.whereType<SomePropertyView>().first;
      final pattern = RegExp(
        r'(\w+ChannelPropertyView)\??\s+get\s+\w+\s*=>\s*properties\.whereType<(\w+ChannelPropertyView)>\(\)\.(first(?:OrNull)?)',
        multiLine: true,
      );

      for (final match in pattern.allMatches(content)) {
        final className = match.group(2)!;
        final accessor = match.group(3)!;
        final isNullable = accessor == 'firstOrNull';
        accessors[className] = isNullable;
      }

      return accessors;
    }

    test('all channel views have correct property optionality', () {
      final fileMapping = getChannelFileMapping();
      final propertyPatterns = getPropertyClassPatterns();
      final mismatches = <String>[];
      final skippedChannels = <String>[];

      for (final channelEntry in channelsSpec.entries) {
        final channelCategory = channelEntry.key;
        final channelSpec = channelEntry.value as Map<String, dynamic>;

        // Skip generic channel
        if (channelCategory == 'generic') continue;

        // Check if view file exists
        final fileName = fileMapping[channelCategory];
        if (fileName == null) {
          skippedChannels.add(channelCategory);
          continue;
        }

        final viewFile = File('$viewsBasePath/$fileName.dart');
        if (!viewFile.existsSync()) {
          skippedChannels.add('$channelCategory (file not found)');
          continue;
        }

        // Parse the view file
        final content = viewFile.readAsStringSync();
        final accessors = parsePropertyAccessors(content);

        // Check each property in the spec
        final properties = channelSpec['properties'] as Map<String, dynamic>?;
        if (properties == null) continue;

        for (final propEntry in properties.entries) {
          final propCategory = propEntry.key;
          final propSpec = propEntry.value as Map<String, dynamic>;
          final isRequired = propSpec['required'] as bool? ?? false;

          // Get the expected class name for this property
          final expectedClass = propertyPatterns[propCategory];
          if (expectedClass == null) continue;

          // Check if the property is defined in the view
          if (!accessors.containsKey(expectedClass)) {
            // Property not defined in view - might be inherited from mixin or not implemented
            continue;
          }

          final isNullableInView = accessors[expectedClass]!;

          // Required properties should use .first (non-nullable)
          // Optional properties should use .firstOrNull (nullable)
          if (isRequired && isNullableInView) {
            mismatches.add(
              '$channelCategory.$propCategory: spec says required=true, '
              'but view uses .firstOrNull (should use .first)',
            );
          } else if (!isRequired && !isNullableInView) {
            mismatches.add(
              '$channelCategory.$propCategory: spec says required=false, '
              'but view uses .first (should use .firstOrNull)',
            );
          }
        }
      }

      // Report results
      if (skippedChannels.isNotEmpty) {
        // This is informational, not a failure
        // ignore: avoid_print
        print('Skipped channels without view files: $skippedChannels');
      }

      expect(mismatches, isEmpty,
          reason: 'Property optionality mismatches found:\n${mismatches.join('\n')}');
    });

    test('spec file contains expected channels', () {
      // Verify the spec file has the expected structure
      expect(channelsSpec, isNotEmpty);
      expect(channelsSpec.containsKey('light'), isTrue);
      expect(channelsSpec.containsKey('fan'), isTrue);
      expect(channelsSpec.containsKey('device_information'), isTrue);
    });

    test('channel spec properties have required field', () {
      for (final channelEntry in channelsSpec.entries) {
        final channelCategory = channelEntry.key;
        final channelSpec = channelEntry.value as Map<String, dynamic>;

        final properties = channelSpec['properties'] as Map<String, dynamic>?;
        if (properties == null) continue;

        for (final propEntry in properties.entries) {
          final propCategory = propEntry.key;
          final propSpec = propEntry.value as Map<String, dynamic>;

          expect(propSpec.containsKey('required'), isTrue,
              reason:
                  '$channelCategory.$propCategory should have a "required" field');
        }
      }
    });
  });

  group('Device Views Spec Validation', () {
    late Map<String, dynamic> devicesSpec;
    late String viewsBasePath;

    setUpAll(() {
      final currentDir = Directory.current.path;
      String projectRoot;

      if (currentDir.contains('apps/panel')) {
        projectRoot = currentDir.replaceAll(RegExp(r'/apps/panel.*'), '');
      } else {
        projectRoot = currentDir;
      }

      final specFile = File('$projectRoot/spec/devices/devices.yaml');
      expect(specFile.existsSync(), isTrue,
          reason: 'devices.yaml spec file should exist');

      final specContent = specFile.readAsStringSync();
      final yamlData = loadYaml(specContent) as YamlMap;
      devicesSpec = _yamlToMap(yamlData);

      viewsBasePath =
          '$projectRoot/apps/panel/lib/modules/devices/views/devices';
    });

    /// Map of channel category to expected Dart channel view class
    Map<String, String> getChannelViewClassMapping() {
      return {
        'air_particulate': 'AirParticulateChannelView',
        'air_quality': 'AirQualityChannelView',
        'alarm': 'AlarmChannelView',
        'battery': 'BatteryChannelView',
        'camera': 'CameraChannelView',
        'carbon_dioxide': 'CarbonDioxideChannelView',
        'carbon_monoxide': 'CarbonMonoxideChannelView',
        'contact': 'ContactChannelView',
        'cooler': 'CoolerChannelView',
        'dehumidifier': 'DehumidifierChannelView',
        'device_information': 'DeviceInformationChannelView',
        'door': 'DoorChannelView',
        'doorbell': 'DoorbellChannelView',
        'electrical_energy': 'ElectricalEnergyChannelView',
        'electrical_power': 'ElectricalPowerChannelView',
        'fan': 'FanChannelView',
        'filter': 'FilterChannelView',
        'flow': 'FlowChannelView',
        'gas': 'GasChannelView',
        'heater': 'HeaterChannelView',
        'humidity': 'HumidityChannelView',
        'humidifier': 'HumidifierChannelView',
        'illuminance': 'IlluminanceChannelView',
        'leak': 'LeakChannelView',
        'light': 'LightChannelView',
        'lock': 'LockChannelView',
        'media_input': 'MediaInputChannelView',
        'media_playback': 'MediaPlaybackChannelView',
        'microphone': 'MicrophoneChannelView',
        'motion': 'MotionChannelView',
        'nitrogen_dioxide': 'NitrogenDioxideChannelView',
        'occupancy': 'OccupancyChannelView',
        'outlet': 'OutletChannelView',
        'ozone': 'OzoneChannelView',
        'pressure': 'PressureChannelView',
        'robot_vacuum': 'RobotVacuumChannelView',
        'smoke': 'SmokeChannelView',
        'speaker': 'SpeakerChannelView',
        'sulphur_dioxide': 'SulphurDioxideChannelView',
        'switcher': 'SwitcherChannelView',
        'television': 'TelevisionChannelView',
        'temperature': 'TemperatureChannelView',
        'thermostat': 'ThermostatChannelView',
        'valve': 'ValveChannelView',
        'volatile_organic_compounds': 'VolatileOrganicCompoundsChannelView',
        'window_covering': 'WindowCoveringChannelView',
      };
    }

    /// Map of device category to Dart file name
    Map<String, String> getDeviceFileMapping() {
      return {
        'air_conditioner': 'air_conditioner',
        'air_dehumidifier': 'air_dehumidifier',
        'air_humidifier': 'air_humidifier',
        'air_purifier': 'air_purifier',
        'alarm': 'alarm',
        'camera': 'camera',
        'door': 'door',
        'doorbell': 'doorbell',
        'fan': 'fan',
        'garage': 'garage',
        'heater': 'heater',
        'lighting': 'lighting',
        'lock': 'lock',
        'media': 'media',
        'outlet': 'outlet',
        'pump': 'pump',
        'robot_vacuum': 'robot_vacuum',
        'roller_shutter': 'roller_shutter',
        'sensor': 'sensor',
        'speaker': 'speaker',
        'sprinkler': 'sprinkler',
        'switcher': 'switcher',
        'television': 'television',
        'thermostat': 'thermostat',
        'valve': 'valve',
        'window_covering': 'window_covering',
      };
    }

    /// Parse a device view file and extract channel accessor definitions
    /// Returns a map of channel class name to whether it's nullable (uses firstOrNull)
    Map<String, bool> parseChannelAccessors(String content) {
      final accessors = <String, bool>{};

      // Pattern to match channel accessors like:
      // SomeChannelView? get someChannel => channels.whereType<SomeChannelView>().firstOrNull;
      // SomeChannelView get someChannel => channels.whereType<SomeChannelView>().first;
      final pattern = RegExp(
        r'(\w+ChannelView)\??\s+get\s+\w+\s*=>\s*channels\.whereType<(\w+ChannelView)>\(\)\.(first(?:OrNull)?)',
        multiLine: true,
      );

      for (final match in pattern.allMatches(content)) {
        final className = match.group(2)!;
        final accessor = match.group(3)!;
        final isNullable = accessor == 'firstOrNull';
        accessors[className] = isNullable;
      }

      return accessors;
    }

    test('all device views have correct channel optionality', () {
      final fileMapping = getDeviceFileMapping();
      final channelViewMapping = getChannelViewClassMapping();
      final mismatches = <String>[];
      final skippedDevices = <String>[];

      for (final deviceEntry in devicesSpec.entries) {
        final deviceCategory = deviceEntry.key;
        final deviceSpec = deviceEntry.value as Map<String, dynamic>;

        // Skip generic device
        if (deviceCategory == 'generic') continue;

        // Check if view file exists
        final fileName = fileMapping[deviceCategory];
        if (fileName == null) {
          skippedDevices.add(deviceCategory);
          continue;
        }

        final viewFile = File('$viewsBasePath/$fileName.dart');
        if (!viewFile.existsSync()) {
          skippedDevices.add('$deviceCategory (file not found)');
          continue;
        }

        // Parse the view file
        final content = viewFile.readAsStringSync();
        final accessors = parseChannelAccessors(content);

        // Check each channel in the spec
        final channels = deviceSpec['channels'] as Map<String, dynamic>?;
        if (channels == null) continue;

        for (final channelEntry in channels.entries) {
          final channelCategory = channelEntry.key;
          final channelSpec = channelEntry.value as Map<String, dynamic>;
          final isRequired = channelSpec['required'] as bool? ?? false;

          // Get the expected class name for this channel
          final expectedClass = channelViewMapping[channelCategory];
          if (expectedClass == null) continue;

          // Check if the channel is defined in the view
          if (!accessors.containsKey(expectedClass)) {
            // Channel not defined directly in view - might be inherited from mixin
            continue;
          }

          final isNullableInView = accessors[expectedClass]!;

          // Required channels should use .first (non-nullable)
          // Optional channels should use .firstOrNull (nullable)
          if (isRequired && isNullableInView) {
            mismatches.add(
              '$deviceCategory.$channelCategory: spec says required=true, '
              'but view uses .firstOrNull (should use .first)',
            );
          } else if (!isRequired && !isNullableInView) {
            mismatches.add(
              '$deviceCategory.$channelCategory: spec says required=false, '
              'but view uses .first (should use .firstOrNull)',
            );
          }
        }
      }

      if (skippedDevices.isNotEmpty) {
        // ignore: avoid_print
        print('Skipped devices without view files: $skippedDevices');
      }

      expect(mismatches, isEmpty,
          reason: 'Channel optionality mismatches found:\n${mismatches.join('\n')}');
    });

    test('spec file contains expected devices', () {
      expect(devicesSpec, isNotEmpty);
      expect(devicesSpec.containsKey('lighting'), isTrue);
      expect(devicesSpec.containsKey('thermostat'), isTrue);
      expect(devicesSpec.containsKey('sensor'), isTrue);
    });
  });
}

/// Converts YamlMap to regular `Map<String, dynamic>`
Map<String, dynamic> _yamlToMap(YamlMap yamlMap) {
  final result = <String, dynamic>{};
  for (final entry in yamlMap.entries) {
    final key = entry.key.toString();
    final value = entry.value;
    result[key] = _convertYamlValue(value);
  }
  return result;
}

/// Converts YAML values to Dart types
dynamic _convertYamlValue(dynamic value) {
  if (value is YamlMap) {
    return _yamlToMap(value);
  } else if (value is YamlList) {
    return value.map(_convertYamlValue).toList();
  } else {
    return value;
  }
}
