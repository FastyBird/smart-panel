import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/model.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

class FakePropertyCommandItem extends Fake implements PropertyCommandItem {}

void main() {
  group('HeatingUnitDeviceController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late HeatingUnitDeviceView device;
    late HeatingUnitDeviceController controller;

    const deviceId = 'device-123';
    const heaterChannelId = 'heater-channel-456';
    const temperatureChannelId = 'temperature-channel-789';
    const deviceInfoChannelId = 'device-info-000';
    const onPropId = 'on-prop-101';
    const tempPropId = 'temp-prop-102';
    const statusPropId = 'status-prop-103';
    const measuredTempPropId = 'measured-temp-prop-104';

    setUpAll(() {
      registerFallbackValue(FakePropertyCommandItem());
      registerFallbackValue(<PropertyCommandItem>[]);
    });

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      device = HeatingUnitDeviceView(
        id: deviceId,
        type: 'heating_unit',
        category: DevicesModuleDeviceCategory.heatingUnit,
        name: 'Test Heating Unit',
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
                value: StringValueType('Test Manufacturer'),
              ),
              ModelChannelPropertyView(
                id: 'model-prop',
                type: 'model',
                channel: deviceInfoChannelId,
                value: StringValueType('Test Model'),
              ),
            ],
          ),
          HeaterChannelView(
            id: heaterChannelId,
            type: 'heater',
            category: DevicesModuleChannelCategory.heater,
            device: deviceId,
            properties: [
              OnChannelPropertyView(
                id: onPropId,
                type: 'on',
                channel: heaterChannelId,
                category: DevicesModulePropertyCategory.valueOn,
                value: BooleanValueType(true),
              ),
              TemperatureChannelPropertyView(
                id: tempPropId,
                type: 'temperature',
                channel: heaterChannelId,
                category: DevicesModulePropertyCategory.temperature,
                value: NumberValueType(21.5),
                format: NumberListFormatType([16.0, 30.0]),
              ),
              StatusChannelPropertyView(
                id: statusPropId,
                type: 'status',
                channel: heaterChannelId,
                category: DevicesModulePropertyCategory.generic,
                value: BooleanValueType(true), // isHeating
              ),
            ],
          ),
          TemperatureChannelView(
            id: temperatureChannelId,
            type: 'temperature',
            category: DevicesModuleChannelCategory.temperature,
            device: deviceId,
            properties: [
              TemperatureChannelPropertyView(
                id: measuredTempPropId,
                type: 'temperature',
                channel: temperatureChannelId,
                category: DevicesModulePropertyCategory.temperature,
                value: NumberValueType(20.0),
              ),
            ],
          ),
        ],
      );

      controller = HeatingUnitDeviceController(
        device: device,
        controlState: mockControlState,
        devicesService: mockDevicesService,
      );
    });

    tearDown(() {
      reset(mockControlState);
      reset(mockDevicesService);
    });

    group('channel access', () {
      test('heater getter returns HeaterChannelController', () {
        expect(controller.heater, isNotNull);
      });
    });

    group('device-level getters', () {
      test('isOn returns optimistic-aware value from heater controller', () {
        when(() => mockControlState.isLocked(deviceId, heaterChannelId, onPropId))
            .thenReturn(false);

        expect(controller.isOn, isTrue);
      });

      test('isOn returns optimistic value when heater is locked', () {
        when(() => mockControlState.isLocked(deviceId, heaterChannelId, onPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, heaterChannelId, onPropId)).thenReturn(false);

        expect(controller.isOn, isFalse);
      });

      test('temperature returns optimistic-aware value from heater controller',
          () {
        when(() =>
                mockControlState.isLocked(deviceId, heaterChannelId, tempPropId))
            .thenReturn(false);

        expect(controller.temperature, equals(21.5));
      });

      test('temperature returns optimistic value when heater is locked', () {
        when(() =>
                mockControlState.isLocked(deviceId, heaterChannelId, tempPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, heaterChannelId, tempPropId)).thenReturn(25.0);

        expect(controller.temperature, equals(25.0));
      });
    });

    group('passthrough getters', () {
      test('isHeating returns channel value', () {
        expect(controller.isHeating, isTrue);
      });

      test('minTemperature returns channel value', () {
        expect(controller.minTemperature, equals(16.0));
      });

      test('maxTemperature returns channel value', () {
        expect(controller.maxTemperature, equals(30.0));
      });
    });

    group('device-level commands', () {
      test('setPower delegates to heater controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              onPropId,
            )).thenReturn(null);

        controller.setPower(false);

        verify(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              onPropId,
              false,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(onPropId, false))
            .called(1);
      });

      test('togglePower delegates to heater controller', () {
        when(() =>
                mockControlState.isLocked(deviceId, heaterChannelId, onPropId))
            .thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              onPropId,
            )).thenReturn(null);

        controller.togglePower();

        verify(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              onPropId,
              false,
            )).called(1);
      });

      test('setTemperature delegates to heater controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              tempPropId,
              22.5,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(tempPropId, 22.5))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              tempPropId,
            )).thenReturn(null);

        controller.setTemperature(22.5);

        verify(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              tempPropId,
              22.5,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(tempPropId, 22.5))
            .called(1);
      });
    });

    group('batch operations', () {
      test('setMultipleProperties succeeds and transitions all to settling',
          () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: onPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: tempPropId,
            value: 23.0,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              any(),
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              any(),
            )).thenReturn(null);

        var successCalled = false;
        controller.setMultipleProperties(
          commands,
          onSuccess: () => successCalled = true,
        );

        // Verify pending was set immediately for both
        verify(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              onPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              tempPropId,
              23.0,
            )).called(1);

        await Future.delayed(Duration.zero);

        // Verify API was called
        verify(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).called(1);

        // Verify settling was called for both on success
        verify(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              onPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              tempPropId,
            )).called(1);

        expect(successCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on API failure', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: onPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: tempPropId,
            value: 23.0,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              any(),
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              any(),
            )).thenReturn(null);

        var errorCalled = false;
        controller.setMultipleProperties(
          commands,
          onError: () => errorCalled = true,
        );

        await Future.delayed(Duration.zero);

        // Verify clear was called for both on failure
        verify(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              onPropId,
            )).called(1);
        verify(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              tempPropId,
            )).called(1);

        // Verify setSettling was NOT called
        verifyNever(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              any(),
            ));

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on exception', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => throw Exception('Network error'));
        when(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              onPropId,
            )).thenReturn(null);

        var errorCalled = false;
        controller.setMultipleProperties(
          commands,
          onError: () => errorCalled = true,
        );

        await Future.delayed(Duration.zero);

        // Verify clear was called on exception
        verify(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              onPropId,
            )).called(1);

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties calls controller onError callback on failure',
          () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = HeatingUnitDeviceController(
          device: device,
          controlState: mockControlState,
          devicesService: mockDevicesService,
          onError: (propertyId, error) {
            errorPropertyId = propertyId;
            errorObject = error;
          },
        );

        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              onPropId,
            )).thenReturn(null);

        controllerWithError.setMultipleProperties(commands);

        await Future.delayed(Duration.zero);

        expect(errorPropertyId, equals(onPropId));
        expect(errorObject, isA<Exception>());
      });
    });
  });
}
