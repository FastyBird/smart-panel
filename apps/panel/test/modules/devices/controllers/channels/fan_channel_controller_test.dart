import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/speed.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/swing.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  group('FanChannelController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late FanChannelView fanChannel;
    late FanChannelController controller;

    const deviceId = 'device-123';
    const channelId = 'channel-456';
    const onPropId = 'on-prop-789';
    const swingPropId = 'swing-prop-101';
    const speedPropId = 'speed-prop-102';
    const modePropId = 'mode-prop-103';
    const lockedPropId = 'locked-prop-104';

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      // Create test channel with properties
      fanChannel = FanChannelView(
        id: channelId,
        type: 'fan',
        category: DevicesModuleChannelCategory.fan,
        device: deviceId,
        properties: [
          OnChannelPropertyView(
            id: onPropId,
            type: 'on',
            channel: channelId,
            category: DevicesModulePropertyCategory.valueOn,
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
          SwingChannelPropertyView(
            id: swingPropId,
            type: 'swing',
            channel: channelId,
            category: DevicesModulePropertyCategory.swing,
            valueState: PropertyValueState(value: BooleanValueType(false)),
          ),
          SpeedChannelPropertyView(
            id: speedPropId,
            type: 'speed',
            channel: channelId,
            category: DevicesModulePropertyCategory.speed,
            valueState: PropertyValueState(value: NumberValueType(50)),
            format: NumberListFormatType([0, 100]),
          ),
          ModeChannelPropertyView(
            id: modePropId,
            type: 'mode',
            channel: channelId,
            category: DevicesModulePropertyCategory.mode,
            valueState: PropertyValueState(value: StringValueType('auto')),
            format: StringListFormatType(['auto', 'sleep', 'turbo']),
          ),
          LockedChannelPropertyView(
            id: lockedPropId,
            type: 'locked',
            channel: channelId,
            category: DevicesModulePropertyCategory.locked,
            valueState: PropertyValueState(value: BooleanValueType(false)),
          ),
        ],
      );

      controller = FanChannelController(
        deviceId: deviceId,
        channel: fanChannel,
        controlState: mockControlState,
        devicesService: mockDevicesService,
      );
    });

    group('optimistic-aware getters', () {
      test('isOn returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, onPropId))
            .thenReturn(false);

        expect(controller.isOn, isTrue);
      });

      test('isOn returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, onPropId))
            .thenReturn(true);
        when(() =>
                mockControlState.getDesiredValue(deviceId, channelId, onPropId))
            .thenReturn(false);

        expect(controller.isOn, isFalse);
      });

      test('swing returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, swingPropId))
            .thenReturn(false);

        expect(controller.swing, isFalse);
      });

      test('swing returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, swingPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, swingPropId)).thenReturn(true);

        expect(controller.swing, isTrue);
      });

      test('speed returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, speedPropId))
            .thenReturn(false);

        expect(controller.speed, 50.0);
      });

      test('speed returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, speedPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, speedPropId)).thenReturn(75.0);

        expect(controller.speed, 75.0);
      });

      test('mode returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, modePropId))
            .thenReturn(false);

        expect(controller.mode, FanModeValue.auto);
      });

      test('mode returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, modePropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, modePropId)).thenReturn('turbo');

        expect(controller.mode, FanModeValue.turbo);
      });

      test('locked returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, lockedPropId))
            .thenReturn(false);

        expect(controller.locked, isFalse);
      });

      test('locked returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, lockedPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, lockedPropId)).thenReturn(true);

        expect(controller.locked, isTrue);
      });
    });

    group('passthrough getters', () {
      test('hasSwing returns channel value', () {
        expect(controller.hasSwing, isTrue);
      });

      test('hasSpeed returns channel value', () {
        expect(controller.hasSpeed, isTrue);
      });

      test('minSpeed returns channel value', () {
        expect(controller.minSpeed, 0.0);
      });

      test('maxSpeed returns channel value', () {
        expect(controller.maxSpeed, 100.0);
      });

      test('hasMode returns channel value', () {
        expect(controller.hasMode, isTrue);
      });

      test('availableModes returns channel value', () {
        expect(
          controller.availableModes,
          containsAll([FanModeValue.auto, FanModeValue.sleep, FanModeValue.turbo]),
        );
      });

      test('hasLocked returns channel value', () {
        expect(controller.hasLocked, isTrue);
      });
    });

    group('commands', () {
      test('setPower calls setPending and then setSettling after API call', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              onPropId,
            )).thenReturn(null);

        controller.setPower(false);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              onPropId,
              false,
            )).called(1);

        // Wait for async API call to complete
        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(onPropId, false))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              onPropId,
            )).called(1);
      });

      test('togglePower toggles current power state', () {
        when(() => mockControlState.isLocked(deviceId, channelId, onPropId))
            .thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              onPropId,
              false, // Toggle from true to false
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              onPropId,
            )).thenReturn(null);

        controller.togglePower();

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              onPropId,
              false,
            )).called(1);
      });

      test('setSwing calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              swingPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(swingPropId, true))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              swingPropId,
            )).thenReturn(null);

        controller.setSwing(true);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              swingPropId,
              true,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(swingPropId, true))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              swingPropId,
            )).called(1);
      });

      test('setSpeed calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              speedPropId,
              75.0,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(speedPropId, 75.0))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              speedPropId,
            )).thenReturn(null);

        controller.setSpeed(75.0);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              speedPropId,
              75.0,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(speedPropId, 75.0))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              speedPropId,
            )).called(1);
      });

      test('setMode calls setPending with enum value string', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              modePropId,
              'turbo',
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(modePropId, 'turbo'))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              modePropId,
            )).thenReturn(null);

        controller.setMode(FanModeValue.turbo);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              modePropId,
              'turbo',
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(modePropId, 'turbo'))
            .called(1);
      });

      test('setLocked calls setPending and then setSettling', () async {
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

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              lockedPropId,
            )).called(1);
      });
    });

    group('error handling', () {
      test('setPower calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = FanChannelController(
          deviceId: deviceId,
          channel: fanChannel,
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
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              onPropId,
            )).thenReturn(null);

        controllerWithError.setPower(false);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              onPropId,
            )).called(1);
        expect(errorPropertyId, onPropId);
        expect(errorObject, isA<Exception>());
      });

      test('setSwing calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = FanChannelController(
          deviceId: deviceId,
          channel: fanChannel,
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
              swingPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(swingPropId, true))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              swingPropId,
            )).thenReturn(null);

        controllerWithError.setSwing(true);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              swingPropId,
            )).called(1);
        expect(errorPropertyId, swingPropId);
        expect(errorObject, isA<Exception>());
      });

      test('setSpeed calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = FanChannelController(
          deviceId: deviceId,
          channel: fanChannel,
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
              speedPropId,
              75.0,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(speedPropId, 75.0))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              speedPropId,
            )).thenReturn(null);

        controllerWithError.setSpeed(75.0);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              speedPropId,
            )).called(1);
        expect(errorPropertyId, speedPropId);
        expect(errorObject, isA<Exception>());
      });

      test('setMode calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = FanChannelController(
          deviceId: deviceId,
          channel: fanChannel,
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
              modePropId,
              'turbo',
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(modePropId, 'turbo'))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              modePropId,
            )).thenReturn(null);

        controllerWithError.setMode(FanModeValue.turbo);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              modePropId,
            )).called(1);
        expect(errorPropertyId, modePropId);
        expect(errorObject, isA<Exception>());
      });

      test('setLocked calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = FanChannelController(
          deviceId: deviceId,
          channel: fanChannel,
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

      test('setPower calls clear and onError on exception', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = FanChannelController(
          deviceId: deviceId,
          channel: fanChannel,
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
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) => Future.error(Exception('Network error')));
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              onPropId,
            )).thenReturn(null);

        controllerWithError.setPower(false);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              onPropId,
            )).called(1);
        expect(errorPropertyId, onPropId);
        expect(errorObject, isA<Exception>());
      });
    });

    group('null-safe commands', () {
      test('setSwing does nothing when swingProp is null', () {
        // Create channel without swing property
        final channelWithoutSwing = FanChannelView(
          id: channelId,
          type: 'fan',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
          ],
        );

        final controllerWithoutSwing = FanChannelController(
          deviceId: deviceId,
          channel: channelWithoutSwing,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutSwing.setSwing(true);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setSpeed does nothing when speedProp is null', () {
        final channelWithoutSpeed = FanChannelView(
          id: channelId,
          type: 'fan',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
          ],
        );

        final controllerWithoutSpeed = FanChannelController(
          deviceId: deviceId,
          channel: channelWithoutSpeed,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutSpeed.setSpeed(50.0);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setMode does nothing when modeProp is null', () {
        final channelWithoutMode = FanChannelView(
          id: channelId,
          type: 'fan',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
          ],
        );

        final controllerWithoutMode = FanChannelController(
          deviceId: deviceId,
          channel: channelWithoutMode,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutMode.setMode(FanModeValue.turbo);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setLocked does nothing when lockedProp is null', () {
        final channelWithoutLocked = FanChannelView(
          id: channelId,
          type: 'fan',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
          ],
        );

        final controllerWithoutLocked = FanChannelController(
          deviceId: deviceId,
          channel: channelWithoutLocked,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutLocked.setLocked(true);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });
    });
  });
}
