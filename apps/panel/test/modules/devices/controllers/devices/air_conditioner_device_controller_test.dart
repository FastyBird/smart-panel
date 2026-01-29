import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/model.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

class FakePropertyCommandItem extends Fake implements PropertyCommandItem {}

void main() {
  group('AirConditionerDeviceController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late AirConditionerDeviceView device;
    late AirConditionerDeviceController controller;

    const deviceId = 'device-123';
    const coolerChannelId = 'cooler-channel-456';
    const fanChannelId = 'fan-channel-789';
    const temperatureChannelId = 'temperature-channel-000';
    const deviceInfoChannelId = 'device-info-111';
    const coolerOnPropId = 'cooler-on-prop-101';
    const coolerTempPropId = 'cooler-temp-prop-102';
    const coolerStatusPropId = 'cooler-status-prop-103';
    const fanOnPropId = 'fan-on-prop-104';
    const measuredTempPropId = 'measured-temp-prop-105';

    setUpAll(() {
      registerFallbackValue(FakePropertyCommandItem());
      registerFallbackValue(<PropertyCommandItem>[]);
    });

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      device = AirConditionerDeviceView(
        id: deviceId,
        type: 'air_conditioner',
        category: DevicesModuleDeviceCategory.airConditioner,
        name: 'Test Air Conditioner',
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
          CoolerChannelView(
            id: coolerChannelId,
            type: 'cooler',
            category: DevicesModuleChannelCategory.cooler,
            device: deviceId,
            properties: [
              OnChannelPropertyView(
                id: coolerOnPropId,
                type: 'on',
                channel: coolerChannelId,
                category: DevicesModulePropertyCategory.valueOn,
                valueState: PropertyValueState(value: BooleanValueType(true)),
              ),
              TemperatureChannelPropertyView(
                id: coolerTempPropId,
                type: 'temperature',
                channel: coolerChannelId,
                category: DevicesModulePropertyCategory.temperature,
                valueState: PropertyValueState(value: NumberValueType(24.0)),
                format: NumberListFormatType([18.0, 30.0]),
              ),
              StatusChannelPropertyView(
                id: coolerStatusPropId,
                type: 'status',
                channel: coolerChannelId,
                category: DevicesModulePropertyCategory.generic,
                valueState: PropertyValueState(value: BooleanValueType(true)), // isCooling
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
                id: fanOnPropId,
                type: 'on',
                channel: fanChannelId,
                category: DevicesModulePropertyCategory.valueOn,
                valueState: PropertyValueState(value: BooleanValueType(true)),
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
                valueState: PropertyValueState(value: NumberValueType(26.0)),
              ),
            ],
          ),
        ],
      );

      controller = AirConditionerDeviceController(
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
      test('cooler getter returns CoolerChannelController', () {
        expect(controller.cooler, isNotNull);
      });

      test('fan getter returns FanChannelController', () {
        expect(controller.fan, isNotNull);
      });

      test('heater getter returns null when no heater channel', () {
        expect(controller.heater, isNull);
      });
    });

    group('device-level getters', () {
      test('isCoolerOn returns optimistic-aware value from cooler controller',
          () {
        when(() =>
                mockControlState.isLocked(deviceId, coolerChannelId, coolerOnPropId))
            .thenReturn(false);

        expect(controller.isCoolerOn, isTrue);
      });

      test('isCoolerOn returns optimistic value when cooler is locked', () {
        when(() =>
                mockControlState.isLocked(deviceId, coolerChannelId, coolerOnPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, coolerChannelId, coolerOnPropId)).thenReturn(false);

        expect(controller.isCoolerOn, isFalse);
      });

      test('isCooling returns cooler status', () {
        expect(controller.isCooling, isTrue);
      });

      test(
          'coolingTemperature returns optimistic-aware value from cooler controller',
          () {
        when(() => mockControlState.isLocked(
            deviceId, coolerChannelId, coolerTempPropId)).thenReturn(false);

        expect(controller.coolingTemperature, equals(24.0));
      });

      test('coolingTemperature returns optimistic value when cooler is locked',
          () {
        when(() => mockControlState.isLocked(
            deviceId, coolerChannelId, coolerTempPropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, coolerChannelId, coolerTempPropId)).thenReturn(22.0);

        expect(controller.coolingTemperature, equals(22.0));
      });

      test('isHeaterOn returns null when no heater channel', () {
        expect(controller.isHeaterOn, isNull);
      });

      test('isHeating returns false when no heater channel', () {
        expect(controller.isHeating, isFalse);
      });

      test('heatingTemperature returns null when no heater channel', () {
        expect(controller.heatingTemperature, isNull);
      });
    });

    group('passthrough getters', () {
      test('hasHeater returns false when no heater channel', () {
        expect(controller.hasHeater, isFalse);
      });

      test('minCoolingTemperature returns cooler channel value', () {
        expect(controller.minCoolingTemperature, equals(18.0));
      });

      test('maxCoolingTemperature returns cooler channel value', () {
        expect(controller.maxCoolingTemperature, equals(30.0));
      });

      test('minHeatingTemperature returns null when no heater channel', () {
        expect(controller.minHeatingTemperature, isNull);
      });

      test('maxHeatingTemperature returns null when no heater channel', () {
        expect(controller.maxHeatingTemperature, isNull);
      });
    });

    group('device-level commands', () {
      test('setCoolerPower delegates to cooler controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(coolerOnPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
            )).thenReturn(null);

        controller.setCoolerPower(false);

        verify(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
              false,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(coolerOnPropId, false))
            .called(1);
      });

      test('toggleCoolerPower delegates to cooler controller', () {
        when(() =>
                mockControlState.isLocked(deviceId, coolerChannelId, coolerOnPropId))
            .thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(coolerOnPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
            )).thenReturn(null);

        controller.toggleCoolerPower();

        verify(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
              false,
            )).called(1);
      });

      test('setCoolingTemperature delegates to cooler controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerTempPropId,
              22.0,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(coolerTempPropId, 22.0))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              coolerChannelId,
              coolerTempPropId,
            )).thenReturn(null);

        controller.setCoolingTemperature(22.0);

        verify(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerTempPropId,
              22.0,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(coolerTempPropId, 22.0))
            .called(1);
      });
    });

    group('batch operations', () {
      test('setMultipleProperties succeeds and transitions all to settling',
          () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: coolerChannelId,
            propertyId: coolerOnPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: coolerChannelId,
            propertyId: coolerTempPropId,
            value: 23.0,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              any(),
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              coolerChannelId,
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
              coolerChannelId,
              coolerOnPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerTempPropId,
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
              coolerChannelId,
              coolerOnPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              coolerChannelId,
              coolerTempPropId,
            )).called(1);

        expect(successCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on API failure', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: coolerChannelId,
            propertyId: coolerOnPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: coolerChannelId,
            propertyId: coolerTempPropId,
            value: 23.0,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              any(),
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              coolerChannelId,
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
              coolerChannelId,
              coolerOnPropId,
            )).called(1);
        verify(() => mockControlState.clear(
              deviceId,
              coolerChannelId,
              coolerTempPropId,
            )).called(1);

        // Verify setSettling was NOT called
        verifyNever(() => mockControlState.setSettling(
              deviceId,
              coolerChannelId,
              any(),
            ));

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on exception', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: coolerChannelId,
            propertyId: coolerOnPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => throw Exception('Network error'));
        when(() => mockControlState.clear(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
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
              coolerChannelId,
              coolerOnPropId,
            )).called(1);

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties calls controller onError callback on failure',
          () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = AirConditionerDeviceController(
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
            channelId: coolerChannelId,
            propertyId: coolerOnPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
            )).thenReturn(null);

        controllerWithError.setMultipleProperties(commands);

        await Future.delayed(Duration.zero);

        expect(errorPropertyId, equals(coolerOnPropId));
        expect(errorObject, isA<Exception>());
      });

      test('setMultipleProperties handles commands across multiple channels',
          () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: coolerChannelId,
            propertyId: coolerOnPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: fanChannelId,
            propertyId: fanOnPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              any(),
              any(),
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              any(),
              any(),
            )).thenReturn(null);

        controller.setMultipleProperties(commands);

        // Verify pending was set for both channels
        verify(() => mockControlState.setPending(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              fanOnPropId,
              true,
            )).called(1);

        await Future.delayed(Duration.zero);

        // Verify settling was called for both channels
        verify(() => mockControlState.setSettling(
              deviceId,
              coolerChannelId,
              coolerOnPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              fanOnPropId,
            )).called(1);
      });
    });
  });
}
