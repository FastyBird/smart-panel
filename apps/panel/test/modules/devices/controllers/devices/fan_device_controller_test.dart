import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
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
  group('FanDeviceController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late FanDeviceView fanDevice;
    late FanDeviceController controller;

    const deviceId = 'device-123';
    const fanChannelId = 'fan-channel-456';
    const deviceInfoChannelId = 'device-info-789';
    const onPropId = 'on-prop-101';

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      // Create test device with fan channel
      fanDevice = FanDeviceView(
        id: deviceId,
        type: 'fan',
        category: DevicesModuleDeviceCategory.fan,
        name: 'Test Fan',
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
          FanChannelView(
            id: fanChannelId,
            type: 'fan',
            category: DevicesModuleChannelCategory.fan,
            device: deviceId,
            properties: [
              OnChannelPropertyView(
                id: onPropId,
                type: 'on',
                channel: fanChannelId,
                category: DevicesModulePropertyCategory.valueOn,
                valueState: PropertyValueState(value: BooleanValueType(true)),
              ),
            ],
          ),
        ],
      );

      controller = FanDeviceController(
        device: fanDevice,
        controlState: mockControlState,
        devicesService: mockDevicesService,
      );
    });

    group('channel access', () {
      test('fan getter returns FanChannelController', () {
        expect(controller.fan, isNotNull);
      });
    });

    group('device-level getters', () {
      test('isOn returns optimistic-aware value from fan controller', () {
        when(() => mockControlState.isLocked(deviceId, fanChannelId, onPropId))
            .thenReturn(false);

        expect(controller.isOn, isTrue);
      });

      test('isOn returns optimistic value when fan is locked', () {
        when(() => mockControlState.isLocked(deviceId, fanChannelId, onPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, fanChannelId, onPropId)).thenReturn(false);

        expect(controller.isOn, isFalse);
      });
    });

    group('device-level commands', () {
      test('setPower delegates to fan controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              onPropId,
            )).thenReturn(null);

        controller.setPower(false);

        verify(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              false,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(onPropId, false))
            .called(1);
      });

      test('togglePower delegates to fan controller', () {
        when(() => mockControlState.isLocked(deviceId, fanChannelId, onPropId))
            .thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              onPropId,
            )).thenReturn(null);

        controller.togglePower();

        verify(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              false,
            )).called(1);
      });
    });
  });
}
