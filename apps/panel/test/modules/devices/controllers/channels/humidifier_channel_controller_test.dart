import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mist_level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/timer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/warm_mist.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  group('HumidifierChannelController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late HumidifierChannelView humidifierChannel;
    late HumidifierChannelController controller;

    const deviceId = 'device-123';
    const channelId = 'channel-456';
    const onPropId = 'on-prop-789';
    const humidityPropId = 'humidity-prop-101';
    const modePropId = 'mode-prop-102';
    const mistLevelPropId = 'mist-level-prop-103';
    const warmMistPropId = 'warm-mist-prop-104';
    const lockedPropId = 'locked-prop-105';
    const timerPropId = 'timer-prop-106';

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      // Create test channel with properties
      humidifierChannel = HumidifierChannelView(
        id: channelId,
        type: 'humidifier',
        category: DevicesModuleChannelCategory.humidifier,
        device: deviceId,
        properties: [
          OnChannelPropertyView(
            id: onPropId,
            type: 'on',
            channel: channelId,
            category: DevicesModulePropertyCategory.valueOn,
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
          HumidityChannelPropertyView(
            id: humidityPropId,
            type: 'humidity',
            channel: channelId,
            category: DevicesModulePropertyCategory.humidity,
            valueState: PropertyValueState(value: NumberValueType(50)),
            format: NumberListFormatType([30, 80]),
          ),
          ModeChannelPropertyView(
            id: modePropId,
            type: 'mode',
            channel: channelId,
            category: DevicesModulePropertyCategory.mode,
            valueState: PropertyValueState(value: StringValueType('auto')),
            format: StringListFormatType(['auto', 'sleep', 'manual']),
          ),
          MistLevelChannelPropertyView(
            id: mistLevelPropId,
            type: 'mist_level',
            channel: channelId,
            category: DevicesModulePropertyCategory.mistLevel,
            valueState: PropertyValueState(value: NumberValueType(50)),
            format: NumberListFormatType([0, 100]),
          ),
          WarmMistChannelPropertyView(
            id: warmMistPropId,
            type: 'warm_mist',
            channel: channelId,
            category: DevicesModulePropertyCategory.warmMist,
            valueState: PropertyValueState(value: BooleanValueType(false)),
          ),
          LockedChannelPropertyView(
            id: lockedPropId,
            type: 'locked',
            channel: channelId,
            category: DevicesModulePropertyCategory.locked,
            valueState: PropertyValueState(value: BooleanValueType(false)),
          ),
          TimerChannelPropertyView(
            id: timerPropId,
            type: 'timer',
            channel: channelId,
            category: DevicesModulePropertyCategory.timer,
            valueState: PropertyValueState(value: NumberValueType(0)),
            format: NumberListFormatType([0, 86400]),
          ),
        ],
      );

      controller = HumidifierChannelController(
        deviceId: deviceId,
        channel: humidifierChannel,
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
        when(() => mockControlState.isLocked(deviceId, channelId, humidityPropId))
            .thenReturn(false);

        expect(controller.humidity, 50);
      });

      test('humidity returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, humidityPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, humidityPropId)).thenReturn(65);

        expect(controller.humidity, 65);
      });

      test('mode returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, modePropId))
            .thenReturn(false);

        expect(controller.mode, HumidifierModeValue.auto);
      });

      test('mode returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, modePropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, modePropId)).thenReturn('sleep');

        expect(controller.mode, HumidifierModeValue.sleep);
      });

      test('mistLevel returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, mistLevelPropId))
            .thenReturn(false);

        expect(controller.mistLevel, 50);
      });

      test('mistLevel returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, mistLevelPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, mistLevelPropId)).thenReturn(75);

        expect(controller.mistLevel, 75);
      });

      test('warmMist returns actual value when not locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, warmMistPropId))
            .thenReturn(false);

        expect(controller.warmMist, isFalse);
      });

      test('warmMist returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(deviceId, channelId, warmMistPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, warmMistPropId)).thenReturn(true);

        expect(controller.warmMist, isTrue);
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
          containsAll([HumidifierModeValue.auto, HumidifierModeValue.sleep]),
        );
      });

      test('hasMistLevel returns channel value', () {
        expect(controller.hasMistLevel, isTrue);
      });

      test('minMistLevel returns channel value', () {
        expect(controller.minMistLevel, 0);
      });

      test('maxMistLevel returns channel value', () {
        expect(controller.maxMistLevel, 100);
      });

      test('hasWarmMist returns channel value', () {
        expect(controller.hasWarmMist, isTrue);
      });

      test('hasLocked returns channel value', () {
        expect(controller.hasLocked, isTrue);
      });

      test('hasTimer returns channel value', () {
        expect(controller.hasTimer, isTrue);
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

      test('setHumidity calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              humidityPropId,
              65,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(humidityPropId, 65))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              humidityPropId,
            )).thenReturn(null);

        controller.setHumidity(65);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              humidityPropId,
              65,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(humidityPropId, 65))
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
              'sleep',
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(modePropId, 'sleep'))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              modePropId,
            )).thenReturn(null);

        controller.setMode(HumidifierModeValue.sleep);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              modePropId,
              'sleep',
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(modePropId, 'sleep'))
            .called(1);
      });

      test('setMistLevel calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              mistLevelPropId,
              75,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(mistLevelPropId, 75))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              mistLevelPropId,
            )).thenReturn(null);

        controller.setMistLevel(75);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              mistLevelPropId,
              75,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(mistLevelPropId, 75))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              mistLevelPropId,
            )).called(1);
      });

      test('setWarmMist calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              warmMistPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(warmMistPropId, true))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              warmMistPropId,
            )).thenReturn(null);

        controller.setWarmMist(true);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              warmMistPropId,
              true,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(warmMistPropId, true))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              warmMistPropId,
            )).called(1);
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

        final controllerWithError = HumidifierChannelController(
          deviceId: deviceId,
          channel: humidifierChannel,
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

        final controllerWithError = HumidifierChannelController(
          deviceId: deviceId,
          channel: humidifierChannel,
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
              65,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(humidityPropId, 65))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              humidityPropId,
            )).thenReturn(null);

        controllerWithError.setHumidity(65);

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

        final controllerWithError = HumidifierChannelController(
          deviceId: deviceId,
          channel: humidifierChannel,
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
        final channelWithoutMode = HumidifierChannelView(
          id: channelId,
          type: 'humidifier',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
            HumidityChannelPropertyView(
              id: humidityPropId,
              type: 'humidity',
              channel: channelId,
              valueState: PropertyValueState(value: NumberValueType(50)),
            ),
          ],
        );

        final controllerWithoutMode = HumidifierChannelController(
          deviceId: deviceId,
          channel: channelWithoutMode,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutMode.setMode(HumidifierModeValue.sleep);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setMistLevel does nothing when mistLevelProp is null', () {
        final channelWithoutMistLevel = HumidifierChannelView(
          id: channelId,
          type: 'humidifier',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
            HumidityChannelPropertyView(
              id: humidityPropId,
              type: 'humidity',
              channel: channelId,
              valueState: PropertyValueState(value: NumberValueType(50)),
            ),
          ],
        );

        final controllerWithoutMistLevel = HumidifierChannelController(
          deviceId: deviceId,
          channel: channelWithoutMistLevel,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutMistLevel.setMistLevel(75);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setWarmMist does nothing when warmMistProp is null', () {
        final channelWithoutWarmMist = HumidifierChannelView(
          id: channelId,
          type: 'humidifier',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
            HumidityChannelPropertyView(
              id: humidityPropId,
              type: 'humidity',
              channel: channelId,
              valueState: PropertyValueState(value: NumberValueType(50)),
            ),
          ],
        );

        final controllerWithoutWarmMist = HumidifierChannelController(
          deviceId: deviceId,
          channel: channelWithoutWarmMist,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutWarmMist.setWarmMist(true);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setLocked does nothing when lockedProp is null', () {
        final channelWithoutLocked = HumidifierChannelView(
          id: channelId,
          type: 'humidifier',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
            HumidityChannelPropertyView(
              id: humidityPropId,
              type: 'humidity',
              channel: channelId,
              valueState: PropertyValueState(value: NumberValueType(50)),
            ),
          ],
        );

        final controllerWithoutLocked = HumidifierChannelController(
          deviceId: deviceId,
          channel: channelWithoutLocked,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutLocked.setLocked(true);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setTimer does nothing when timerProp is null', () {
        final channelWithoutTimer = HumidifierChannelView(
          id: channelId,
          type: 'humidifier',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              valueState: PropertyValueState(value: BooleanValueType(true)),
            ),
            HumidityChannelPropertyView(
              id: humidityPropId,
              type: 'humidity',
              channel: channelId,
              valueState: PropertyValueState(value: NumberValueType(50)),
            ),
          ],
        );

        final controllerWithoutTimer = HumidifierChannelController(
          deviceId: deviceId,
          channel: channelWithoutTimer,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutTimer.setTimer(3600);

        verifyNever(() => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });
    });
  });
}
