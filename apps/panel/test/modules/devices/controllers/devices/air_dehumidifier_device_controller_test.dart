import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/model.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDeviceControlStateService extends Mock
    implements DeviceControlStateService {}

class MockDevicesService extends Mock implements DevicesService {}

class FakePropertyCommandItem extends Fake implements PropertyCommandItem {}

void main() {
  group('AirDehumidifierDeviceController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late AirDehumidifierDeviceView device;
    late AirDehumidifierDeviceController controller;

    const deviceId = 'device-123';
    const dehumidifierChannelId = 'dehumidifier-channel-456';
    const humidityChannelId = 'humidity-channel-789';
    const deviceInfoChannelId = 'device-info-000';
    const onPropId = 'on-prop-101';
    const humidityPropId = 'humidity-prop-102';
    const measuredHumidityPropId = 'measured-humidity-prop-103';

    setUpAll(() {
      registerFallbackValue(FakePropertyCommandItem());
      registerFallbackValue(<PropertyCommandItem>[]);
    });

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      device = AirDehumidifierDeviceView(
        id: deviceId,
        type: 'air_dehumidifier',
        category: DevicesModuleDeviceCategory.airDehumidifier,
        name: 'Test Air Dehumidifier',
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
          DehumidifierChannelView(
            id: dehumidifierChannelId,
            type: 'dehumidifier',
            category: DevicesModuleChannelCategory.dehumidifier,
            device: deviceId,
            properties: [
              OnChannelPropertyView(
                id: onPropId,
                type: 'on',
                channel: dehumidifierChannelId,
                category: DevicesModulePropertyCategory.valueOn,
                value: BooleanValueType(true),
              ),
              HumidityChannelPropertyView(
                id: humidityPropId,
                type: 'humidity',
                channel: dehumidifierChannelId,
                category: DevicesModulePropertyCategory.humidity,
                value: NumberValueType(50),
                format: NumberListFormatType([30.0, 80.0]),
              ),
            ],
          ),
          HumidityChannelView(
            id: humidityChannelId,
            type: 'humidity',
            category: DevicesModuleChannelCategory.humidity,
            device: deviceId,
            properties: [
              HumidityChannelPropertyView(
                id: measuredHumidityPropId,
                type: 'humidity',
                channel: humidityChannelId,
                category: DevicesModulePropertyCategory.humidity,
                value: NumberValueType(65),
              ),
            ],
          ),
        ],
      );

      controller = AirDehumidifierDeviceController(
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
      test('dehumidifier getter returns DehumidifierChannelController', () {
        expect(controller.dehumidifier, isNotNull);
      });

      test('fan getter returns null when no fan channel', () {
        expect(controller.fan, isNull);
      });
    });

    group('device-level getters', () {
      test('isOn returns optimistic-aware value from dehumidifier controller',
          () {
        when(() => mockControlState.isLocked(
            deviceId, dehumidifierChannelId, onPropId)).thenReturn(false);

        expect(controller.isOn, isTrue);
      });

      test('isOn returns optimistic value when dehumidifier is locked', () {
        when(() => mockControlState.isLocked(
            deviceId, dehumidifierChannelId, onPropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, dehumidifierChannelId, onPropId)).thenReturn(false);

        expect(controller.isOn, isFalse);
      });

      test(
          'humidity returns optimistic-aware value from dehumidifier controller',
          () {
        when(() => mockControlState.isLocked(
            deviceId, dehumidifierChannelId, humidityPropId)).thenReturn(false);

        expect(controller.humidity, equals(50));
      });

      test('humidity returns optimistic value when dehumidifier is locked', () {
        when(() => mockControlState.isLocked(
            deviceId, dehumidifierChannelId, humidityPropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, dehumidifierChannelId, humidityPropId)).thenReturn(45);

        expect(controller.humidity, equals(45));
      });
    });

    group('passthrough getters', () {
      test('hasFan returns false when no fan channel', () {
        expect(controller.hasFan, isFalse);
      });

      test('minHumidity returns channel value', () {
        expect(controller.minHumidity, equals(30));
      });

      test('maxHumidity returns channel value', () {
        expect(controller.maxHumidity, equals(80));
      });
    });

    group('device-level commands', () {
      test('setPower delegates to dehumidifier controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              dehumidifierChannelId,
              onPropId,
            )).thenReturn(null);

        controller.setPower(false);

        verify(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              onPropId,
              false,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(onPropId, false))
            .called(1);
      });

      test('togglePower delegates to dehumidifier controller', () {
        when(() => mockControlState.isLocked(
            deviceId, dehumidifierChannelId, onPropId)).thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              dehumidifierChannelId,
              onPropId,
            )).thenReturn(null);

        controller.togglePower();

        verify(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              onPropId,
              false,
            )).called(1);
      });

      test('setHumidity delegates to dehumidifier controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              humidityPropId,
              55,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(humidityPropId, 55))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              dehumidifierChannelId,
              humidityPropId,
            )).thenReturn(null);

        controller.setHumidity(55);

        verify(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              humidityPropId,
              55,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(humidityPropId, 55))
            .called(1);
      });
    });

    group('batch operations', () {
      test('setMultipleProperties succeeds and transitions all to settling',
          () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: dehumidifierChannelId,
            propertyId: onPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: dehumidifierChannelId,
            propertyId: humidityPropId,
            value: 60,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              any(),
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              dehumidifierChannelId,
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
              dehumidifierChannelId,
              onPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              humidityPropId,
              60,
            )).called(1);

        await Future.delayed(Duration.zero);

        // Verify API was called
        verify(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).called(1);

        // Verify settling was called for both on success
        verify(() => mockControlState.setSettling(
              deviceId,
              dehumidifierChannelId,
              onPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              dehumidifierChannelId,
              humidityPropId,
            )).called(1);

        expect(successCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on API failure', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: dehumidifierChannelId,
            propertyId: onPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: dehumidifierChannelId,
            propertyId: humidityPropId,
            value: 60,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              any(),
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              dehumidifierChannelId,
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
              dehumidifierChannelId,
              onPropId,
            )).called(1);
        verify(() => mockControlState.clear(
              deviceId,
              dehumidifierChannelId,
              humidityPropId,
            )).called(1);

        // Verify setSettling was NOT called
        verifyNever(() => mockControlState.setSettling(
              deviceId,
              dehumidifierChannelId,
              any(),
            ));

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on exception', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: dehumidifierChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => throw Exception('Network error'));
        when(() => mockControlState.clear(
              deviceId,
              dehumidifierChannelId,
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
              dehumidifierChannelId,
              onPropId,
            )).called(1);

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties calls controller onError callback on failure',
          () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = AirDehumidifierDeviceController(
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
            channelId: dehumidifierChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              dehumidifierChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              dehumidifierChannelId,
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
