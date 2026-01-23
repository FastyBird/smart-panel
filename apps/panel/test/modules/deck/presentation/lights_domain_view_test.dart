import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/lights_domain_view.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// =============================================================================
// Tests for LightsDomainViewPage
// =============================================================================

void main() {
  group('LightingModeUI', () {
    test('should have all expected lighting modes', () {
      expect(LightingModeUI.values, [
        LightingModeUI.off,
        LightingModeUI.work,
        LightingModeUI.relax,
        LightingModeUI.night,
      ]);
    });

    test('should have 4 lighting modes', () {
      expect(LightingModeUI.values.length, 4);
    });

    test('off mode should be first in enum (index 0)', () {
      expect(LightingModeUI.values[0], LightingModeUI.off);
    });
  });

  group('LightingModeUIExtension.toBackendMode()', () {
    test('off mode should return LightingMode.off', () {
      expect(LightingModeUI.off.toBackendMode(), LightingMode.off);
    });

    test('work mode should return LightingMode.work', () {
      expect(LightingModeUI.work.toBackendMode(), LightingMode.work);
    });

    test('relax mode should return LightingMode.relax', () {
      expect(LightingModeUI.relax.toBackendMode(), LightingMode.relax);
    });

    test('night mode should return LightingMode.night', () {
      expect(LightingModeUI.night.toBackendMode(), LightingMode.night);
    });

    test('all non-off modes should have a corresponding backend mode', () {
      for (final mode in LightingModeUI.values) {
        if (mode != LightingModeUI.off) {
          expect(mode.toBackendMode(), isNotNull,
              reason: '${mode.name} should have a backend mode');
        }
      }
    });
  });

  group('LightingModeUIExtension.fromBackendMode()', () {
    group('when no lights are on', () {
      test('should return off regardless of backend mode', () {
        expect(
          LightingModeUIExtension.fromBackendMode(LightingMode.work, false),
          LightingModeUI.off,
        );
        expect(
          LightingModeUIExtension.fromBackendMode(LightingMode.relax, false),
          LightingModeUI.off,
        );
        expect(
          LightingModeUIExtension.fromBackendMode(LightingMode.night, false),
          LightingModeUI.off,
        );
        expect(
          LightingModeUIExtension.fromBackendMode(null, false),
          LightingModeUI.off,
        );
      });
    });

    group('when lights are on', () {
      test('should return work when backend mode is null (default)', () {
        expect(
          LightingModeUIExtension.fromBackendMode(null, true),
          LightingModeUI.work,
        );
      });

      test('should return work when backend mode is work', () {
        expect(
          LightingModeUIExtension.fromBackendMode(LightingMode.work, true),
          LightingModeUI.work,
        );
      });

      test('should return relax when backend mode is relax', () {
        expect(
          LightingModeUIExtension.fromBackendMode(LightingMode.relax, true),
          LightingModeUI.relax,
        );
      });

      test('should return night when backend mode is night', () {
        expect(
          LightingModeUIExtension.fromBackendMode(LightingMode.night, true),
          LightingModeUI.night,
        );
      });
    });

    group('round-trip conversion', () {
      test('converting to backend and back should preserve mode (when on)', () {
        for (final mode in LightingModeUI.values) {
          if (mode == LightingModeUI.off) continue;

          final backendMode = mode.toBackendMode();
          final roundTrip =
              LightingModeUIExtension.fromBackendMode(backendMode, true);

          expect(roundTrip, mode,
              reason: '${mode.name} should survive round-trip conversion');
        }
      });

      test('off mode round-trip works correctly', () {
        // off -> LightingMode.off backend mode
        final backendMode = LightingModeUI.off.toBackendMode();
        expect(backendMode, LightingMode.off);

        // With lights off, should return off
        final roundTrip =
            LightingModeUIExtension.fromBackendMode(backendMode, false);
        expect(roundTrip, LightingModeUI.off);

        // With lights on and off mode, should still return off (mode takes precedence)
        final roundTripWithLightsOn =
            LightingModeUIExtension.fromBackendMode(backendMode, true);
        expect(roundTripWithLightsOn, LightingModeUI.off);
      });
    });
  });

  group('LightState', () {
    test('should have all expected states', () {
      expect(LightState.values, [
        LightState.off,
        LightState.on,
        LightState.offline,
      ]);
    });

    test('should have 3 states', () {
      expect(LightState.values.length, 3);
    });
  });

  group('LightDeviceData', () {
    test('should correctly identify on state', () {
      const device = LightDeviceData(
        deviceId: 'd1',
        channelId: 'c1',
        name: 'Test Light',
        state: LightState.on,
      );
      expect(device.isOn, true);
      expect(device.isOffline, false);
    });

    test('should correctly identify off state', () {
      const device = LightDeviceData(
        deviceId: 'd1',
        channelId: 'c1',
        name: 'Test Light',
        state: LightState.off,
      );
      expect(device.isOn, false);
      expect(device.isOffline, false);
    });

    test('should correctly identify offline state', () {
      const device = LightDeviceData(
        deviceId: 'd1',
        channelId: 'c1',
        name: 'Test Light',
        state: LightState.offline,
      );
      expect(device.isOn, false);
      expect(device.isOffline, true);
    });

    test('should format status text correctly for off state', () {
      const device = LightDeviceData(
        deviceId: 'd1',
        channelId: 'c1',
        name: 'Test Light',
        state: LightState.off,
      );
      expect(device.statusText, 'Off');
    });

    test('should format status text correctly for on state with brightness', () {
      const device = LightDeviceData(
        deviceId: 'd1',
        channelId: 'c1',
        name: 'Test Light',
        state: LightState.on,
        brightness: 75,
      );
      expect(device.statusText, '75%');
    });

    test('should format status text correctly for on state without brightness', () {
      const device = LightDeviceData(
        deviceId: 'd1',
        channelId: 'c1',
        name: 'Test Light',
        state: LightState.on,
      );
      expect(device.statusText, 'On');
    });

    test('should format status text correctly for offline state', () {
      const device = LightDeviceData(
        deviceId: 'd1',
        channelId: 'c1',
        name: 'Test Light',
        state: LightState.offline,
      );
      expect(device.statusText, 'Offline');
    });
  });

  group('LightingRoleData', () {
    test('should correctly identify when lights are on', () {
      const role = LightingRoleData(
        role: LightTargetRole.main,
        name: 'Main',
        icon: Icons.lightbulb,
        onCount: 2,
        totalCount: 5,
        targets: [],
      );
      expect(role.hasLightsOn, true);
    });

    test('should correctly identify when no lights are on', () {
      const role = LightingRoleData(
        role: LightTargetRole.main,
        name: 'Main',
        icon: Icons.lightbulb,
        onCount: 0,
        totalCount: 5,
        targets: [],
      );
      expect(role.hasLightsOn, false);
    });

    test('should format status text without brightness', () {
      const role = LightingRoleData(
        role: LightTargetRole.main,
        name: 'Main',
        icon: Icons.lightbulb,
        onCount: 2,
        totalCount: 5,
        targets: [],
      );
      expect(role.statusText, '2/5');
    });

    test('should format status text with brightness when lights are on', () {
      const role = LightingRoleData(
        role: LightTargetRole.main,
        name: 'Main',
        icon: Icons.lightbulb,
        onCount: 2,
        totalCount: 5,
        brightness: 80,
        targets: [],
      );
      expect(role.statusText, '2/5 \u2022 80%');
    });

    test('should not show brightness when no lights are on', () {
      const role = LightingRoleData(
        role: LightTargetRole.main,
        name: 'Main',
        icon: Icons.lightbulb,
        onCount: 0,
        totalCount: 5,
        brightness: 80,
        targets: [],
      );
      expect(role.statusText, '0/5');
    });
  });
}
