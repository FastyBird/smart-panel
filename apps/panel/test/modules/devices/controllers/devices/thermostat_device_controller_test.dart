import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
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
  group('ThermostatDeviceController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late ThermostatDeviceView device;
    late ThermostatDeviceController controller;

    const deviceId = 'device-123';
    const thermostatChannelId = 'thermostat-channel-456';
    const heaterChannelId = 'heater-channel-789';
    const temperatureChannelId = 'temperature-channel-000';
    const deviceInfoChannelId = 'device-info-111';
    const lockedPropId = 'locked-prop-101';
    const heaterOnPropId = 'heater-on-prop-102';
    const heaterTempPropId = 'heater-temp-prop-103';
    const heaterStatusPropId = 'heater-status-prop-104';
    const measuredTempPropId = 'measured-temp-prop-105';

    setUpAll(() {
      registerFallbackValue(FakePropertyCommandItem());
      registerFallbackValue(<PropertyCommandItem>[]);
    });

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      device = ThermostatDeviceView(
        id: deviceId,
        type: 'thermostat',
        category: DevicesModuleDeviceCategory.thermostat,
        name: 'Test Thermostat',
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
          ThermostatChannelView(
            id: thermostatChannelId,
            type: 'thermostat',
            category: DevicesModuleChannelCategory.thermostat,
            device: deviceId,
            properties: [
              LockedChannelPropertyView(
                id: lockedPropId,
                type: 'locked',
                channel: thermostatChannelId,
                category: DevicesModulePropertyCategory.locked,
                value: BooleanValueType(false),
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
                id: heaterOnPropId,
                type: 'on',
                channel: heaterChannelId,
                category: DevicesModulePropertyCategory.valueOn,
                value: BooleanValueType(true),
              ),
              TemperatureChannelPropertyView(
                id: heaterTempPropId,
                type: 'temperature',
                channel: heaterChannelId,
                category: DevicesModulePropertyCategory.temperature,
                value: NumberValueType(21.5),
                format: NumberListFormatType([16.0, 30.0]),
              ),
              StatusChannelPropertyView(
                id: heaterStatusPropId,
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

      controller = ThermostatDeviceController(
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
      test('thermostat getter returns ThermostatChannelController', () {
        expect(controller.thermostat, isNotNull);
      });

      test('heater getter returns HeaterChannelController when available', () {
        expect(controller.heater, isNotNull);
      });

      test('cooler getter returns null when no cooler channel', () {
        expect(controller.cooler, isNull);
      });
    });

    group('device-level getters', () {
      test('isOn returns true when heater is on', () {
        when(() =>
                mockControlState.isLocked(deviceId, heaterChannelId, heaterOnPropId))
            .thenReturn(false);

        expect(controller.isOn, isTrue);
      });

      test('isOn returns optimistic value when heater is locked', () {
        when(() =>
                mockControlState.isLocked(deviceId, heaterChannelId, heaterOnPropId))
            .thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, heaterChannelId, heaterOnPropId)).thenReturn(false);

        expect(controller.isOn, isFalse);
      });

      test('isLocked returns optimistic-aware value from thermostat controller',
          () {
        when(() => mockControlState.isLocked(
            deviceId, thermostatChannelId, lockedPropId)).thenReturn(false);

        expect(controller.isLocked, isFalse);
      });

      test('isLocked returns optimistic value when thermostat is locked', () {
        when(() => mockControlState.isLocked(
            deviceId, thermostatChannelId, lockedPropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, thermostatChannelId, lockedPropId)).thenReturn(true);

        expect(controller.isLocked, isTrue);
      });

      test(
          'heatingTemperature returns optimistic-aware value from heater controller',
          () {
        when(() => mockControlState.isLocked(
            deviceId, heaterChannelId, heaterTempPropId)).thenReturn(false);

        expect(controller.heatingTemperature, equals(21.5));
      });

      test('heatingTemperature returns optimistic value when heater is locked',
          () {
        when(() => mockControlState.isLocked(
            deviceId, heaterChannelId, heaterTempPropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, heaterChannelId, heaterTempPropId)).thenReturn(25.0);

        expect(controller.heatingTemperature, equals(25.0));
      });

      test('coolingTemperature returns null when no cooler channel', () {
        expect(controller.coolingTemperature, isNull);
      });
    });

    group('passthrough getters', () {
      test('hasHeater returns true when heater channel exists', () {
        expect(controller.hasHeater, isTrue);
      });

      test('hasCooler returns false when no cooler channel', () {
        expect(controller.hasCooler, isFalse);
      });

      test('hasThermostatLock returns true when locked property exists', () {
        expect(controller.hasThermostatLock, isTrue);
      });

      test('isHeating returns heater status', () {
        expect(controller.isHeating, isTrue);
      });

      test('isCooling returns false when no cooler channel', () {
        expect(controller.isCooling, isFalse);
      });
    });

    group('device-level commands', () {
      test('setLocked delegates to thermostat controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              thermostatChannelId,
              lockedPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              thermostatChannelId,
              lockedPropId,
            )).thenReturn(null);

        controller.setLocked(true);

        verify(() => mockControlState.setPending(
              deviceId,
              thermostatChannelId,
              lockedPropId,
              true,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .called(1);
      });

      test('toggleLocked delegates to thermostat controller', () {
        when(() => mockControlState.isLocked(
            deviceId, thermostatChannelId, lockedPropId)).thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              thermostatChannelId,
              lockedPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(lockedPropId, true))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              thermostatChannelId,
              lockedPropId,
            )).thenReturn(null);

        controller.toggleLocked();

        verify(() => mockControlState.setPending(
              deviceId,
              thermostatChannelId,
              lockedPropId,
              true,
            )).called(1);
      });

      test('setHeaterPower delegates to heater controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              heaterOnPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(heaterOnPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              heaterOnPropId,
            )).thenReturn(null);

        controller.setHeaterPower(false);

        verify(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              heaterOnPropId,
              false,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(heaterOnPropId, false))
            .called(1);
      });

      test('setHeatingTemperature delegates to heater controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              heaterTempPropId,
              24.0,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(heaterTempPropId, 24.0))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              heaterTempPropId,
            )).thenReturn(null);

        controller.setHeatingTemperature(24.0);

        verify(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              heaterTempPropId,
              24.0,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(heaterTempPropId, 24.0))
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
            propertyId: heaterOnPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: heaterTempPropId,
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
              heaterOnPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              heaterTempPropId,
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
              heaterOnPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              heaterTempPropId,
            )).called(1);

        expect(successCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on API failure', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: heaterOnPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: heaterTempPropId,
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
              heaterOnPropId,
            )).called(1);
        verify(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              heaterTempPropId,
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
            propertyId: heaterOnPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              heaterOnPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => throw Exception('Network error'));
        when(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              heaterOnPropId,
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
              heaterOnPropId,
            )).called(1);

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties calls controller onError callback on failure',
          () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = ThermostatDeviceController(
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
            propertyId: heaterOnPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              heaterChannelId,
              heaterOnPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              heaterChannelId,
              heaterOnPropId,
            )).thenReturn(null);

        controllerWithError.setMultipleProperties(commands);

        await Future.delayed(Duration.zero);

        expect(errorPropertyId, equals(heaterOnPropId));
        expect(errorObject, isA<Exception>());
      });

      test('setMultipleProperties handles commands across multiple channels',
          () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: heaterChannelId,
            propertyId: heaterOnPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: thermostatChannelId,
            propertyId: lockedPropId,
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
              heaterChannelId,
              heaterOnPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              thermostatChannelId,
              lockedPropId,
              true,
            )).called(1);

        await Future.delayed(Duration.zero);

        // Verify settling was called for both channels
        verify(() => mockControlState.setSettling(
              deviceId,
              heaterChannelId,
              heaterOnPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              thermostatChannelId,
              lockedPropId,
            )).called(1);
      });
    });
  });
}
