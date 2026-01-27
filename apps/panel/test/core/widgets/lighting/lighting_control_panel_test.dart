import 'package:fastybird_smart_panel/core/widgets/lighting/export.dart';
import 'package:flutter_test/flutter_test.dart';

// =============================================================================
// Tests for Lighting Types
// =============================================================================

void main() {
  group('LightCapability', () {
    test('should have all expected light capabilities', () {
      expect(LightCapability.values, [
        LightCapability.power,
        LightCapability.brightness,
        LightCapability.colorTemp,
        LightCapability.color,
        LightCapability.white,
      ]);
    });

    test('should have 5 light capabilities', () {
      expect(LightCapability.values.length, 5);
    });
  });

  group('LightingState', () {
    test('should have all expected lighting states', () {
      expect(LightingState.values, [
        LightingState.synced,
        LightingState.mixed,
        LightingState.unsynced,
      ]);
    });

    test('should have 3 lighting states', () {
      expect(LightingState.values.length, 3);
    });
  });

  group('LightingChannelData', () {
    test('should create with required parameters', () {
      const channel = LightingChannelData(
        id: 'ch1',
        name: 'Channel 1',
        isOn: true,
      );

      expect(channel.id, 'ch1');
      expect(channel.name, 'Channel 1');
      expect(channel.isOn, true);
      expect(channel.brightness, 100);
      expect(channel.hasBrightness, true);
      expect(channel.isOnline, true);
      expect(channel.isSelected, false);
    });

    test('should create with all parameters', () {
      const channel = LightingChannelData(
        id: 'ch2',
        name: 'Channel 2',
        isOn: false,
        brightness: 50,
        hasBrightness: false,
        isOnline: false,
        isSelected: true,
      );

      expect(channel.id, 'ch2');
      expect(channel.name, 'Channel 2');
      expect(channel.isOn, false);
      expect(channel.brightness, 50);
      expect(channel.hasBrightness, false);
      expect(channel.isOnline, false);
      expect(channel.isSelected, true);
    });

    test('should use default values', () {
      const channel = LightingChannelData(
        id: 'ch3',
        name: 'Channel 3',
        isOn: true,
      );

      expect(channel.brightness, 100);
      expect(channel.hasBrightness, true);
      expect(channel.isOnline, true);
      expect(channel.isSelected, false);
    });
  });
}
