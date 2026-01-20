import 'dart:ui';

import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_blue.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_green.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_red.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  group('LightChannelController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late LightChannelView lightChannel;
    late LightChannelController controller;

    const deviceId = 'device-123';
    const channelId = 'channel-456';
    const onPropId = 'on-prop-789';
    const brightnessPropId = 'brightness-prop-101';
    const colorRedPropId = 'color-red-prop-102';
    const colorGreenPropId = 'color-green-prop-103';
    const colorBluePropId = 'color-blue-prop-104';

    setUpAll(() {
      registerFallbackValue(<PropertyConfig>[]);
    });

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      // Create test channel with RGB properties
      lightChannel = LightChannelView(
        id: channelId,
        type: 'light',
        category: DevicesModuleChannelCategory.light,
        device: deviceId,
        properties: [
          OnChannelPropertyView(
            id: onPropId,
            type: 'on',
            channel: channelId,
            category: DevicesModulePropertyCategory.valueOn,
            value: BooleanValueType(true),
          ),
          BrightnessChannelPropertyView(
            id: brightnessPropId,
            type: 'brightness',
            channel: channelId,
            category: DevicesModulePropertyCategory.brightness,
            value: NumberValueType(75),
            format: NumberListFormatType([0, 100]),
          ),
          ColorRedChannelPropertyView(
            id: colorRedPropId,
            type: 'color_red',
            channel: channelId,
            category: DevicesModulePropertyCategory.colorRed,
            value: NumberValueType(255),
            format: NumberListFormatType([0, 255]),
          ),
          ColorGreenChannelPropertyView(
            id: colorGreenPropId,
            type: 'color_green',
            channel: channelId,
            category: DevicesModulePropertyCategory.colorGreen,
            value: NumberValueType(128),
            format: NumberListFormatType([0, 255]),
          ),
          ColorBlueChannelPropertyView(
            id: colorBluePropId,
            type: 'color_blue',
            channel: channelId,
            category: DevicesModulePropertyCategory.colorBlue,
            value: NumberValueType(64),
            format: NumberListFormatType([0, 255]),
          ),
        ],
      );

      controller = LightChannelController(
        deviceId: deviceId,
        channel: lightChannel,
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

      test('brightness returns actual value when not locked', () {
        when(() => mockControlState.getGroupPropertyValue(
            deviceId,
            LightChannelController.colorGroupId,
            channelId,
            brightnessPropId)).thenReturn(null);
        when(() => mockControlState.isLocked(
            deviceId, channelId, brightnessPropId)).thenReturn(false);

        expect(controller.brightness, 75);
      });

      test('brightness returns optimistic value when locked', () {
        when(() => mockControlState.getGroupPropertyValue(
            deviceId,
            LightChannelController.colorGroupId,
            channelId,
            brightnessPropId)).thenReturn(null);
        when(() => mockControlState.isLocked(
            deviceId, channelId, brightnessPropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, brightnessPropId)).thenReturn(50);

        expect(controller.brightness, 50);
      });

      test('brightness returns group value when group is locked', () {
        when(() => mockControlState.getGroupPropertyValue(
            deviceId,
            LightChannelController.colorGroupId,
            channelId,
            brightnessPropId)).thenReturn(60);

        expect(controller.brightness, 60);
      });

      test('colorRed returns actual value when not locked', () {
        when(() => mockControlState.getGroupPropertyValue(
            deviceId,
            LightChannelController.colorGroupId,
            channelId,
            colorRedPropId)).thenReturn(null);
        when(() =>
                mockControlState.isLocked(deviceId, channelId, colorRedPropId))
            .thenReturn(false);

        expect(controller.colorRed, 255);
      });

      test('colorRed returns group value when group is locked', () {
        when(() => mockControlState.getGroupPropertyValue(
            deviceId,
            LightChannelController.colorGroupId,
            channelId,
            colorRedPropId)).thenReturn(200);

        expect(controller.colorRed, 200);
      });

      test('colorGreen returns actual value when not locked', () {
        when(() => mockControlState.getGroupPropertyValue(
            deviceId,
            LightChannelController.colorGroupId,
            channelId,
            colorGreenPropId)).thenReturn(null);
        when(() => mockControlState.isLocked(
            deviceId, channelId, colorGreenPropId)).thenReturn(false);

        expect(controller.colorGreen, 128);
      });

      test('colorBlue returns actual value when not locked', () {
        when(() => mockControlState.getGroupPropertyValue(
            deviceId,
            LightChannelController.colorGroupId,
            channelId,
            colorBluePropId)).thenReturn(null);
        when(() =>
                mockControlState.isLocked(deviceId, channelId, colorBluePropId))
            .thenReturn(false);

        expect(controller.colorBlue, 64);
      });
    });

    group('passthrough getters', () {
      test('hasBrightness returns channel value', () {
        expect(controller.hasBrightness, isTrue);
      });

      test('minBrightness returns channel value', () {
        expect(controller.minBrightness, 0);
      });

      test('maxBrightness returns channel value', () {
        expect(controller.maxBrightness, 100);
      });

      test('hasColor returns channel value', () {
        expect(controller.hasColor, isTrue);
      });

      test('hasColorRed returns channel value', () {
        expect(controller.hasColorRed, isTrue);
      });

      test('hasColorGreen returns channel value', () {
        expect(controller.hasColorGreen, isTrue);
      });

      test('hasColorBlue returns channel value', () {
        expect(controller.hasColorBlue, isTrue);
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

      test('setBrightness calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              brightnessPropId,
              50,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(brightnessPropId, 50))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              brightnessPropId,
            )).thenReturn(null);

        controller.setBrightness(50);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              brightnessPropId,
              50,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(brightnessPropId, 50))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              brightnessPropId,
            )).called(1);
      });

      test('setColorRGB calls setGroupPending and then setGroupSettling',
          () async {
        when(() => mockControlState.setGroupPending(
              deviceId,
              LightChannelController.colorGroupId,
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(colorRedPropId, 100))
            .thenAnswer((_) async => true);
        when(() => mockDevicesService.setPropertyValue(colorGreenPropId, 150))
            .thenAnswer((_) async => true);
        when(() => mockDevicesService.setPropertyValue(colorBluePropId, 200))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setGroupSettling(
              deviceId,
              LightChannelController.colorGroupId,
            )).thenReturn(null);

        controller.setColorRGB(100, 150, 200);

        verify(() => mockControlState.setGroupPending(
              deviceId,
              LightChannelController.colorGroupId,
              any(),
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(colorRedPropId, 100))
            .called(1);
        verify(() => mockDevicesService.setPropertyValue(colorGreenPropId, 150))
            .called(1);
        verify(() => mockDevicesService.setPropertyValue(colorBluePropId, 200))
            .called(1);
        verify(() => mockControlState.setGroupSettling(
              deviceId,
              LightChannelController.colorGroupId,
            )).called(1);
      });

      test('setColor with RGB light calls setColorRGB', () async {
        when(() => mockControlState.setGroupPending(
              deviceId,
              LightChannelController.colorGroupId,
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(colorRedPropId, 128))
            .thenAnswer((_) async => true);
        when(() => mockDevicesService.setPropertyValue(colorGreenPropId, 64))
            .thenAnswer((_) async => true);
        when(() => mockDevicesService.setPropertyValue(colorBluePropId, 32))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setGroupSettling(
              deviceId,
              LightChannelController.colorGroupId,
            )).thenReturn(null);

        // Create a color with specific RGB values using normalized values
        final color = Color.fromARGB(255, 128, 64, 32);
        controller.setColor(color);

        verify(() => mockControlState.setGroupPending(
              deviceId,
              LightChannelController.colorGroupId,
              any(),
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(colorRedPropId, 128))
            .called(1);
        verify(() => mockDevicesService.setPropertyValue(colorGreenPropId, 64))
            .called(1);
        verify(() => mockDevicesService.setPropertyValue(colorBluePropId, 32))
            .called(1);
      });
    });

    group('error handling', () {
      test('setPower calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = LightChannelController(
          deviceId: deviceId,
          channel: lightChannel,
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

      test('setBrightness calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = LightChannelController(
          deviceId: deviceId,
          channel: lightChannel,
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
              brightnessPropId,
              50,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(brightnessPropId, 50))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              brightnessPropId,
            )).thenReturn(null);

        controllerWithError.setBrightness(50);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              brightnessPropId,
            )).called(1);
        expect(errorPropertyId, brightnessPropId);
        expect(errorObject, isA<Exception>());
      });

      test('setColorRGB calls clearGroup and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = LightChannelController(
          deviceId: deviceId,
          channel: lightChannel,
          controlState: mockControlState,
          devicesService: mockDevicesService,
          onError: (propId, error) {
            errorPropertyId = propId;
            errorObject = error;
          },
        );

        when(() => mockControlState.setGroupPending(
              deviceId,
              LightChannelController.colorGroupId,
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(colorRedPropId, 100))
            .thenAnswer((_) async => false);
        when(() => mockDevicesService.setPropertyValue(colorGreenPropId, 150))
            .thenAnswer((_) async => true);
        when(() => mockDevicesService.setPropertyValue(colorBluePropId, 200))
            .thenAnswer((_) async => true);
        when(() => mockControlState.clearGroup(
              deviceId,
              LightChannelController.colorGroupId,
            )).thenReturn(null);

        controllerWithError.setColorRGB(100, 150, 200);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clearGroup(
              deviceId,
              LightChannelController.colorGroupId,
            )).called(1);
        expect(errorPropertyId, colorRedPropId);
        expect(errorObject, isA<Exception>());
      });

      test('setPower calls clear and onError on exception', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = LightChannelController(
          deviceId: deviceId,
          channel: lightChannel,
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
      test('setBrightness does nothing when brightnessProp is null', () {
        final channelWithoutBrightness = LightChannelView(
          id: channelId,
          type: 'light',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              value: BooleanValueType(true),
            ),
          ],
        );

        final controllerWithoutBrightness = LightChannelController(
          deviceId: deviceId,
          channel: channelWithoutBrightness,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutBrightness.setBrightness(50);

        verifyNever(
            () => mockControlState.setPending(any(), any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });

      test('setColorRGB does nothing when color props are null', () {
        final channelWithoutColor = LightChannelView(
          id: channelId,
          type: 'light',
          device: deviceId,
          properties: [
            OnChannelPropertyView(
              id: onPropId,
              type: 'on',
              channel: channelId,
              value: BooleanValueType(true),
            ),
          ],
        );

        final controllerWithoutColor = LightChannelController(
          deviceId: deviceId,
          channel: channelWithoutColor,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        controllerWithoutColor.setColorRGB(100, 150, 200);

        verifyNever(() => mockControlState.setGroupPending(any(), any(), any()));
        verifyNever(() => mockDevicesService.setPropertyValue(any(), any()));
      });
    });
  });
}
