import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/model.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  group('LightingDeviceController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late LightingDeviceView lightingDevice;
    late LightingDeviceController controller;

    const deviceId = 'device-123';
    const lightChannelId = 'light-channel-456';
    const deviceInfoChannelId = 'device-info-789';
    const onPropId = 'on-prop-101';
    const brightnessPropId = 'brightness-prop-102';

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      // Create test device with light channel
      lightingDevice = LightingDeviceView(
        id: deviceId,
        type: 'lighting',
        category: DevicesModuleDeviceCategory.lighting,
        name: 'Test Light',
        channels: [
          DeviceInformationChannelView(
            id: deviceInfoChannelId,
            type: 'device_information',
            category: DevicesModuleChannelCategory.deviceInformation,
            device: deviceId,
            properties: [
              ManufacturerChannelPropertyView(
                id: 'manufacturer-prop',
                type: 'manufacturer',
                channel: deviceInfoChannelId,
                valueState: PropertyValueState(value: StringValueType('Test Manufacturer')),
              ),
              ModelChannelPropertyView(
                id: 'model-prop',
                type: 'model',
                channel: deviceInfoChannelId,
                valueState: PropertyValueState(value: StringValueType('Test Model')),
              ),
            ],
          ),
          LightChannelView(
            id: lightChannelId,
            type: 'light',
            category: DevicesModuleChannelCategory.light,
            device: deviceId,
            properties: [
              OnChannelPropertyView(
                id: onPropId,
                type: 'on',
                channel: lightChannelId,
                category: DevicesModulePropertyCategory.valueOn,
                valueState: PropertyValueState(value: BooleanValueType(true)),
              ),
              BrightnessChannelPropertyView(
                id: brightnessPropId,
                type: 'brightness',
                channel: lightChannelId,
                category: DevicesModulePropertyCategory.brightness,
                valueState: PropertyValueState(value: NumberValueType(75)),
                format: NumberListFormatType([0, 100]),
              ),
            ],
          ),
        ],
      );

      controller = LightingDeviceController(
        device: lightingDevice,
        controlState: mockControlState,
        devicesService: mockDevicesService,
      );
    });

    group('channel access', () {
      test('lights getter returns list of LightChannelControllers', () {
        expect(controller.lights, isNotEmpty);
        expect(controller.lights.length, 1);
      });

      test('light getter returns first LightChannelController', () {
        expect(controller.light, isNotNull);
      });
    });

    group('device-level getters', () {
      test('isOn returns optimistic-aware value from light controller', () {
        when(() =>
                mockControlState.isLocked(deviceId, lightChannelId, onPropId))
            .thenReturn(false);

        expect(controller.isOn, isTrue);
      });

      test('isOn returns optimistic value when light is locked', () {
        when(() =>
                mockControlState.isLocked(deviceId, lightChannelId, onPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, lightChannelId, onPropId)).thenReturn(false);

        expect(controller.isOn, isFalse);
      });

      test('isAnyOn returns true when any light is on', () {
        when(() =>
                mockControlState.isLocked(deviceId, lightChannelId, onPropId))
            .thenReturn(false);

        expect(controller.isAnyOn, isTrue);
      });
    });

    group('passthrough getters', () {
      test('hasBrightness returns device value', () {
        expect(controller.hasBrightness, isTrue);
      });
    });

    group('device-level commands', () {
      test('setPower delegates to all light controllers', () async {
        when(() => mockControlState.setPending(
              deviceId,
              lightChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              lightChannelId,
              onPropId,
            )).thenReturn(null);

        controller.setPower(false);

        verify(() => mockControlState.setPending(
              deviceId,
              lightChannelId,
              onPropId,
              false,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(onPropId, false))
            .called(1);
      });

      test('togglePower toggles all lights', () {
        when(() =>
                mockControlState.isLocked(deviceId, lightChannelId, onPropId))
            .thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              lightChannelId,
              onPropId,
              false, // Toggle from true to false
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              lightChannelId,
              onPropId,
            )).thenReturn(null);

        controller.togglePower();

        verify(() => mockControlState.setPending(
              deviceId,
              lightChannelId,
              onPropId,
              false,
            )).called(1);
      });

      test('setBrightness delegates to all light controllers', () async {
        when(() => mockControlState.getGroupPropertyValue(
            deviceId, any(), lightChannelId, brightnessPropId)).thenReturn(null);
        when(() => mockControlState.isLocked(
            deviceId, lightChannelId, brightnessPropId)).thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              lightChannelId,
              brightnessPropId,
              50,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(brightnessPropId, 50))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              lightChannelId,
              brightnessPropId,
            )).thenReturn(null);

        controller.setBrightness(50);

        verify(() => mockControlState.setPending(
              deviceId,
              lightChannelId,
              brightnessPropId,
              50,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(brightnessPropId, 50))
            .called(1);
      });
    });
  });
}
