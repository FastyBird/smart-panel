import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/climate_domain_view.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// =============================================================================
// Tests for ClimateDomainViewPage
// =============================================================================

void main() {
  group('ClimateMode', () {
    test('should have all expected climate modes', () {
      expect(ClimateMode.values, [
        ClimateMode.off,
        ClimateMode.heat,
        ClimateMode.cool,
        ClimateMode.auto,
      ]);
    });

    test('should have 4 climate modes', () {
      expect(ClimateMode.values.length, 4);
    });
  });

  group('RoomCapability', () {
    test('should have all expected room capabilities', () {
      expect(RoomCapability.values, [
        RoomCapability.none,
        RoomCapability.heaterOnly,
        RoomCapability.coolerOnly,
        RoomCapability.heaterAndCooler,
      ]);
    });

    test('should have 4 room capabilities', () {
      expect(RoomCapability.values.length, 4);
    });
  });

  group('AuxiliaryType', () {
    test('should have all expected auxiliary types', () {
      expect(AuxiliaryType.values, [
        AuxiliaryType.fan,
        AuxiliaryType.purifier,
        AuxiliaryType.humidifier,
        AuxiliaryType.dehumidifier,
      ]);
    });

    test('should have 4 auxiliary types', () {
      expect(AuxiliaryType.values.length, 4);
    });
  });

  group('ClimateDevice', () {
    test('should return correct icon for thermostat type', () {
      const device = ClimateDevice(
        id: 't1',
        name: 'Thermostat',
        type: 'thermostat',
      );
      expect(device.icon, MdiIcons.thermostat);
    });

    test('should return correct icon for ac type', () {
      const device = ClimateDevice(
        id: 'ac1',
        name: 'AC',
        type: 'ac',
      );
      expect(device.icon, MdiIcons.snowflake);
    });

    test('should return correct icon for heating_unit type', () {
      const device = ClimateDevice(
        id: 'h1',
        name: 'Heating Unit',
        type: 'heating_unit',
      );
      expect(device.icon, MdiIcons.fireCircle);
    });

    test('should return correct icon for radiator type', () {
      const device = ClimateDevice(
        id: 'r1',
        name: 'Radiator',
        type: 'radiator',
      );
      expect(device.icon, MdiIcons.radiator);
    });

    test('should return correct icon for floor_heating type', () {
      const device = ClimateDevice(
        id: 'fh1',
        name: 'Floor Heating',
        type: 'floor_heating',
      );
      expect(device.icon, MdiIcons.waves);
    });

    test('should return thermostat icon for unknown type', () {
      const device = ClimateDevice(
        id: 'u1',
        name: 'Unknown',
        type: 'unknown',
      );
      expect(device.icon, MdiIcons.thermostat);
    });
  });

  group('AuxiliaryDevice', () {
    test('should return correct icon for fan type', () {
      const device = AuxiliaryDevice(
        id: 'f1',
        name: 'Fan',
        type: AuxiliaryType.fan,
      );
      expect(device.icon, MdiIcons.fan);
    });

    test('should return correct icon for purifier type', () {
      const device = AuxiliaryDevice(
        id: 'p1',
        name: 'Purifier',
        type: AuxiliaryType.purifier,
      );
      expect(device.icon, MdiIcons.airPurifier);
    });

    test('should return correct icon for humidifier type', () {
      const device = AuxiliaryDevice(
        id: 'h1',
        name: 'Humidifier',
        type: AuxiliaryType.humidifier,
      );
      expect(device.icon, MdiIcons.airHumidifier);
    });

    test('should return correct icon for dehumidifier type', () {
      const device = AuxiliaryDevice(
        id: 'd1',
        name: 'Dehumidifier',
        type: AuxiliaryType.dehumidifier,
      );
      expect(device.icon, MdiIcons.airHumidifierOff);
    });

    test('should identify humidity control devices', () {
      const humidifier = AuxiliaryDevice(
        id: 'h1',
        name: 'Humidifier',
        type: AuxiliaryType.humidifier,
      );
      const dehumidifier = AuxiliaryDevice(
        id: 'd1',
        name: 'Dehumidifier',
        type: AuxiliaryType.dehumidifier,
      );
      const fan = AuxiliaryDevice(
        id: 'f1',
        name: 'Fan',
        type: AuxiliaryType.fan,
      );

      expect(humidifier.isHumidityControl, true);
      expect(dehumidifier.isHumidityControl, true);
      expect(fan.isHumidityControl, false);
    });
  });

  group('ClimateSensor', () {
    test('should return correct icon for temperature type', () {
      const sensor = ClimateSensor(
        id: 't1',
        label: 'Temperature',
        value: '21°C',
        type: DevicesModuleChannelCategory.temperature,
      );
      expect(sensor.icon, MdiIcons.thermometer);
    });

    test('should return correct icon for humidity type', () {
      const sensor = ClimateSensor(
        id: 'h1',
        label: 'Humidity',
        value: '50%',
        type: DevicesModuleChannelCategory.humidity,
      );
      expect(sensor.icon, MdiIcons.waterPercent);
    });

    test('should return correct icon for air quality type', () {
      const sensor = ClimateSensor(
        id: 'a1',
        label: 'Air Quality',
        value: '50',
        type: DevicesModuleChannelCategory.airQuality,
      );
      expect(sensor.icon, MdiIcons.airFilter);
    });

    test('should return correct icon for air particulate type', () {
      const sensor = ClimateSensor(
        id: 'pm1',
        label: 'PM2.5',
        value: '25 µg/m³',
        type: DevicesModuleChannelCategory.airParticulate,
      );
      expect(sensor.icon, MdiIcons.blur);
    });

    test('should return correct icon for carbon dioxide type', () {
      const sensor = ClimateSensor(
        id: 'co2_1',
        label: 'CO2',
        value: '450 ppm',
        type: DevicesModuleChannelCategory.carbonDioxide,
      );
      expect(sensor.icon, MdiIcons.moleculeCo2);
    });

    test('should return correct icon for VOC type', () {
      const sensor = ClimateSensor(
        id: 'voc1',
        label: 'VOC',
        value: '100 ppb',
        type: DevicesModuleChannelCategory.volatileOrganicCompounds,
      );
      expect(sensor.icon, MdiIcons.molecule);
    });

    test('should return correct icon for pressure type', () {
      const sensor = ClimateSensor(
        id: 'p1',
        label: 'Pressure',
        value: '1013 hPa',
        type: DevicesModuleChannelCategory.pressure,
      );
      expect(sensor.icon, MdiIcons.gauge);
    });

    test('should return default icon for unknown type', () {
      const sensor = ClimateSensor(
        id: 'u1',
        label: 'Unknown',
        value: '??',
        type: DevicesModuleChannelCategory.generic,
      );
      expect(sensor.icon, MdiIcons.eyeSettings);
    });
  });

  group('ClimateRoomState', () {
    // Note: modeLabel tests removed - mode labels are now localized via _getModeLabel()

    test('should filter humidity devices correctly', () {
      const state = ClimateRoomState(
        roomName: 'Test Room',
        auxiliaryDevices: [
          AuxiliaryDevice(
              id: 'h1', name: 'Humidifier', type: AuxiliaryType.humidifier),
          AuxiliaryDevice(
              id: 'd1', name: 'Dehumidifier', type: AuxiliaryType.dehumidifier),
          AuxiliaryDevice(id: 'f1', name: 'Fan', type: AuxiliaryType.fan),
          AuxiliaryDevice(
              id: 'p1', name: 'Purifier', type: AuxiliaryType.purifier),
        ],
      );

      expect(state.humidityDevices.length, 2);
      expect(state.otherAuxiliary.length, 2);
      expect(state.hasHumidityControl, true);
    });

    test('should return hasHumidityControl false when no humidity devices', () {
      const state = ClimateRoomState(
        roomName: 'Test Room',
        auxiliaryDevices: [
          AuxiliaryDevice(id: 'f1', name: 'Fan', type: AuxiliaryType.fan),
        ],
      );

      expect(state.hasHumidityControl, false);
    });

    test('should copy state correctly', () {
      const state = ClimateRoomState(
        roomName: 'Test Room',
        mode: ClimateMode.off,
        targetTemp: 20.0,
      );

      final newState = state.copyWith(
        mode: ClimateMode.heat,
        targetTemp: 22.0,
      );

      expect(newState.roomName, 'Test Room');
      expect(newState.mode, ClimateMode.heat);
      expect(newState.targetTemp, 22.0);
    });
  });
}
