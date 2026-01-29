import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  group('HeaterChannelController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late HeaterChannelView heaterChannel;
    late HeaterChannelController controller;

    const deviceId = 'device-123';
    const channelId = 'channel-456';
    const onPropId = 'on-prop-789';
    const temperaturePropId = 'temperature-prop-101';
    const statusPropId = 'status-prop-102';

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      // Create test channel with properties
      heaterChannel = HeaterChannelView(
        id: channelId,
        type: 'heater',
        category: DevicesModuleChannelCategory.heater,
        device: deviceId,
        properties: [
          OnChannelPropertyView(
            id: onPropId,
            type: 'on',
            channel: channelId,
            category: DevicesModulePropertyCategory.valueOn,
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
          TemperatureChannelPropertyView(
            id: temperaturePropId,
            type: 'temperature',
            channel: channelId,
            category: DevicesModulePropertyCategory.temperature,
            valueState: PropertyValueState(value: NumberValueType(22.5)),
            format: NumberListFormatType([15, 35]),
          ),
          StatusChannelPropertyView(
            id: statusPropId,
            type: 'status',
            channel: channelId,
            category: DevicesModulePropertyCategory.status,
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
        ],
      );

      controller = HeaterChannelController(
        deviceId: deviceId,
        channel: heaterChannel,
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

      test('temperature returns actual value when not locked', () {
        when(() => mockControlState.isLocked(
            deviceId, channelId, temperaturePropId)).thenReturn(false);

        expect(controller.temperature, 22.5);
      });

      test('temperature returns optimistic value when locked', () {
        when(() => mockControlState.isLocked(
            deviceId, channelId, temperaturePropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, channelId, temperaturePropId)).thenReturn(25.0);

        expect(controller.temperature, 25.0);
      });
    });

    group('passthrough getters', () {
      test('isHeating returns channel value', () {
        expect(controller.isHeating, isTrue);
      });

      test('minTemperature returns channel value', () {
        expect(controller.minTemperature, 15.0);
      });

      test('maxTemperature returns channel value', () {
        expect(controller.maxTemperature, 35.0);
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

      test('setTemperature calls setPending and then setSettling', () async {
        when(() => mockControlState.setPending(
              deviceId,
              channelId,
              temperaturePropId,
              25.0,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(temperaturePropId, 25.0))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              channelId,
              temperaturePropId,
            )).thenReturn(null);

        controller.setTemperature(25.0);

        verify(() => mockControlState.setPending(
              deviceId,
              channelId,
              temperaturePropId,
              25.0,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(temperaturePropId, 25.0))
            .called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              channelId,
              temperaturePropId,
            )).called(1);
      });
    });

    group('error handling', () {
      test('setPower calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = HeaterChannelController(
          deviceId: deviceId,
          channel: heaterChannel,
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

      test('setTemperature calls clear and onError on API failure', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = HeaterChannelController(
          deviceId: deviceId,
          channel: heaterChannel,
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
              temperaturePropId,
              25.0,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(temperaturePropId, 25.0))
            .thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              channelId,
              temperaturePropId,
            )).thenReturn(null);

        controllerWithError.setTemperature(25.0);

        await Future.delayed(Duration.zero);

        verify(() => mockControlState.clear(
              deviceId,
              channelId,
              temperaturePropId,
            )).called(1);
        expect(errorPropertyId, temperaturePropId);
        expect(errorObject, isA<Exception>());
      });

      test('setPower calls clear and onError on exception', () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = HeaterChannelController(
          deviceId: deviceId,
          channel: heaterChannel,
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
  });
}
