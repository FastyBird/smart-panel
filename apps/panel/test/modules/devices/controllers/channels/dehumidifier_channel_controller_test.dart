import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/timer.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  group('DehumidifierChannelController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late DehumidifierChannelView dehumidifierChannel;
    late DehumidifierChannelController controller;

    const deviceId = 'device-123';
    const channelId = 'channel-456';
    const onPropId = 'on-prop-789';
    const humidityPropId = 'humidity-prop-101';
    const modePropId = 'mode-prop-102';
    const lockedPropId = 'locked-prop-103';
    const timerPropId = 'timer-prop-104';

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      // Create test channel with properties
      dehumidifierChannel = DehumidifierChannelView(
        id: channelId,
        type: 'dehumidifier',
        category: DevicesModuleChannelCategory.dehumidifier,
        device: deviceId,
        properties: [
          OnChannelPropertyView(
            id: onPropId,
            type: 'on',
            channel: channelId,
            category: DevicesModulePropertyCategory.valueOn,
            value: BooleanValueType(true),
          ),
          HumidityChannelPropertyView(
            id: humidityPropId,
            type: 'humidity',
            channel: channelId,
            category: DevicesModulePropertyCategory.humidity,
            value: NumberValueType(50),
            format: NumberListFormatType([30, 80]),
          ),
          ModeChannelPropertyView(
            id: modePropId,
            type: 'mode',
            channel: channelId,
            category: DevicesModulePropertyCategory.mode,
            value: StringValueType('auto'),
            format: StringListFormatType(['auto', 'continuous', 'laundry']),
          ),
          LockedChannelPropertyView(
            id: lockedPropId,
            type: 'locked',
            channel: channelId,
            category: DevicesModulePropertyCategory.locked,
            value: BooleanValueType(false),
          ),
          TimerChannelPropertyView(
            id: timerPropId,
            type: 'timer',
            channel: channelId,
            category: DevicesModulePropertyCategory.timer,
            value: NumberValueType(0),
            format: NumberListFormatType([0, 86400]),
          ),
        ],
      );

      controller = DehumidifierChannelController(
        deviceId: deviceId,
        channel: dehumidifierChannel,
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

      test('humidity returns actual value when not locked', () {
        when(() =>
                mockControlState.isLocked(deviceId, channelId, humidityPropId))
            .thenReturn(false);

        expect(controller.humidity, 50);
      });

      test('humidity returns optimistic value when locked', () {
        when(() =>
                mockControlState.isLocked(deviceId, channelId, humidityPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, humidityPropId)).thenReturn(60);

        expect(controller.humidity, 60);
      });

      test('mode returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, modePropId))
            .thenReturn(false);

        expect(controller.mode, DehumidifierModeValue.auto);
      });

      test('mode returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, modePropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, modePropId)).thenReturn('continuous');

        expect(controller.mode, DehumidifierModeValue.continuous);
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

      test('timer returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, timerPropId))
            .thenReturn(false);

        expect(controller.timer, 0);
      });

      test('timer returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, timerPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, timerPropId)).thenReturn(3600);

        expect(controller.timer, 3600);
      });
    });

    group('passthrough getters', () {
      test('minHumidity returns channel value', () {
        expect(controller.minHumidity, 30);
      });

      test('maxHumidity returns channel value', () {
        expect(controller.maxHumidity, 80);
      });

      test('hasMode returns channel value', () {
        expect(controller.hasMode, isTrue);
      });

      test('availableModes returns channel value', () {
        expect(
          controller.availableModes,
          containsAll([
            DehumidifierModeValue.auto,
            DehumidifierModeValue.continuous,
            DehumidifierModeValue.laundry,
          ]),
        );
      });

      test('hasTimer returns channel value', () {
        expect(controller.hasTimer, isTrue);
      });

      test('hasLocked returns channel value', () {
        expect(controller.hasLocked, isTrue);
      });
    });

    group('commands', () {
      test('setPower calls setPending and then setSettling after API call',
          () async {
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

      test('setHumidity calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              humidityPropId,
              60,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(humidityPropId, 60))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              humidityPropId,
            )).thenReturn(null);

        controller.setHumidity(60);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              humidityPropId,
              60,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(humidityPropId, 60))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              humidityPropId,
            )).called(1);
      });

      test('setMode calls setPending with enum value string', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              modePropId,
              'continuous',
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(modePropId, 'continuous'))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              modePropId,
            )).thenReturn(null);

        controller.setMode(DehumidifierModeValue.continuous);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              modePropId,
              'continuous',
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() =>
                mockDevicesService.setPropertyValue(modePropId, 'continuous'))
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

      test('setTimer calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              timerPropId,
              3600,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(timerPropId, 3600))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              timerPropId,
            )).thenReturn(null);

        controller.setTimer(3600);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              timerPropId,
              3600,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(timerPropId, 3600))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              timerPropId,
            )).called(1);
      });
    });

    group('error handling', () {
      test('setPower calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = DehumidifierChannelController(
          deviceId: deviceId,
          channel: dehumidifierChannel,
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

      test('setHumidity calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = DehumidifierChannelController(
          deviceId: deviceId,
          channel: dehumidifierChannel,
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
              humidityPropId,
              60,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(humidityPropId, 60))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              humidityPropId,
            )).thenReturn(null);

        controllerWithError.setHumidity(60);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              humidityPropId,
            )).called(1);
        expect(errorPropertyId, humidityPropId);
        expect(errorObject, isA<Exception>());
      });

      test('setPower calls clear and onError on exception', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = DehumidifierChannelController(
          deviceId: deviceId,
          channel: dehumidifierChannel,
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
      test('setMode does nothing when modeProp is null', () {
        final channelWithoutMode = DehumidifierChannelView(
          id: channelId,
          type: 'dehumidifier',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              value: BooleanValueType(true),
            ),
            HumidityChannelPropertyView(
              id: humidityPropId,
              type: 'humidity',
              channel: channelId,
              value: NumberValueType(50),
            ),
          ],
        );

        final controllerWithoutMode = DehumidifierChannelController(
          deviceId: deviceId,
          channel: channelWithoutMode,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutMode.setMode(DehumidifierModeValue.continuous);

        verifyNever(
            () => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setLocked does nothing when lockedProp is null', () {
        final channelWithoutLocked = DehumidifierChannelView(
          id: channelId,
          type: 'dehumidifier',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              value: BooleanValueType(true),
            ),
            HumidityChannelPropertyView(
              id: humidityPropId,
              type: 'humidity',
              channel: channelId,
              value: NumberValueType(50),
            ),
          ],
        );

        final controllerWithoutLocked = DehumidifierChannelController(
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

      test('setTimer does nothing when timerProp is null', () {
        final channelWithoutTimer = DehumidifierChannelView(
          id: channelId,
          type: 'dehumidifier',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              value: BooleanValueType(true),
            ),
            HumidityChannelPropertyView(
              id: humidityPropId,
              type: 'humidity',
              channel: channelId,
              value: NumberValueType(50),
            ),
          ],
        );

        final controllerWithoutTimer = DehumidifierChannelController(
          deviceId: deviceId,
          channel: channelWithoutTimer,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutTimer.setTimer(3600);

        verifyNever(
            () => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });
    });
  });
}
