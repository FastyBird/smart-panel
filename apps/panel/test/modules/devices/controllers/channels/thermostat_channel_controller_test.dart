import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  group('ThermostatChannelController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late ThermostatChannelView thermostatChannel;
    late ThermostatChannelController controller;

    const deviceId = 'device-123';
    const channelId = 'channel-456';
    const lockedPropId = 'locked-prop-789';

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      // Create test channel with properties
      thermostatChannel = ThermostatChannelView(
        id: channelId,
        type: 'thermostat',
        category: DevicesModuleChannelCategory.thermostat,
        device: deviceId,
        properties: [
          LockedChannelPropertyView(
            id: lockedPropId,
            type: 'locked',
            channel: channelId,
            category: DevicesModulePropertyCategory.locked,
            valueState: PropertyValueState(value: BooleanValueType(false)),
          ),
        ],
      );

      controller = ThermostatChannelController(
        deviceId: deviceId,
        channel: thermostatChannel,
        controlState: mockControlState,
        devicesService: mockDevicesService,
      );
    });

    group('optimistic-aware getters', () {
      test('isLocked returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, lockedPropId))
            .thenReturn(false);

        expect(controller.isLocked, isFalse);
      });

      test('isLocked returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, lockedPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, lockedPropId)).thenReturn(true);

        expect(controller.isLocked, isTrue);
      });
    });

    group('passthrough getters', () {
      test('hasLocked returns true when lockedProp exists', () {
        expect(controller.hasLocked, isTrue);
      });

      test('hasLocked returns false when lockedProp is null', () {
        final channelWithoutLocked = ThermostatChannelView(
          id: channelId,
          type: 'thermostat',
          device: deviceId,
          properties: [],
        );

        final controllerWithoutLocked = ThermostatChannelController(
          deviceId: deviceId,
          channel: channelWithoutLocked,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        expect(controllerWithoutLocked.hasLocked, isFalse);
      });
    });

    group('commands', () {
      test('setLocked calls setPending and then setSettling after API call',
          () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              lockedPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              lockedPropId,
            )).thenReturn(null);

        controller.setLocked(true);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              lockedPropId,
              true,
            )).called(1);

        // Wait for async API call to complete
        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              lockedPropId,
            )).called(1);
      });

      test('toggleLocked toggles current locked state', () {
        when(() => mockControlState.isLocked(deviceId, channelId, lockedPropId))
            .thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              lockedPropId,
              true, // Toggle from false to true
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              lockedPropId,
            )).thenReturn(null);

        controller.toggleLocked();

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              lockedPropId,
              true,
            )).called(1);
      });
    });

    group('error handling', () {
      test('setLocked calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = ThermostatChannelController(
          deviceId: deviceId,
          channel: thermostatChannel,
          controlState: mockControlState,
          devicesService: mockDevicesService,
          onError: (propId, error) {
            errorPropertyId = propId;
            errorObject = error;
          },
        );

        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              lockedPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              lockedPropId,
            )).thenReturn(null);

        controllerWithError.setLocked(true);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              lockedPropId,
            )).called(1);
        expect(errorPropertyId, lockedPropId);
        expect(errorObject, isA<Exception>());
      });

      test('setLocked calls clear and onError on exception', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = ThermostatChannelController(
          deviceId: deviceId,
          channel: thermostatChannel,
          controlState: mockControlState,
          devicesService: mockDevicesService,
          onError: (propId, error) {
            errorPropertyId = propId;
            errorObject = error;
          },
        );

        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              lockedPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .thenAnswer((_) => Future.error(Exception('Network error')));
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              lockedPropId,
            )).thenReturn(null);

        controllerWithError.setLocked(true);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              lockedPropId,
            )).called(1);
        expect(errorPropertyId, lockedPropId);
        expect(errorObject, isA<Exception>());
      });
    });

    group('null-safe commands', () {
      test('setLocked does nothing when lockedProp is null', () {
        final channelWithoutLocked = ThermostatChannelView(
          id: channelId,
          type: 'thermostat',
          device: deviceId,
          properties: [],
        );

        final controllerWithoutLocked = ThermostatChannelController(
          deviceId: deviceId,
          channel: channelWithoutLocked,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutLocked.setLocked(true);

        verifyNever(
            () => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });
    });
  });
}
