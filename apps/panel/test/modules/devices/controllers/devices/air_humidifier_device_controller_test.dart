import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
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
  group('AirHumidifierDeviceController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late AirHumidifierDeviceView device;
    late AirHumidifierDeviceController controller;

    const deviceId = 'device-123';
    const humidifierChannelId = 'humidifier-channel-456';
    const fanChannelId = 'fan-channel-789';
    const deviceInfoChannelId = 'device-info-000';
    const onPropId = 'on-prop-101';
    const humidityPropId = 'humidity-prop-102';
    const fanOnPropId = 'fan-on-prop-103';

    setUpAll(() {
      registerFallbackValue(FakePropertyCommandItem());
      registerFallbackValue(<PropertyCommandItem>[]);
    });

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      device = AirHumidifierDeviceView(
        id: deviceId,
        type: 'air_humidifier',
        category: DevicesModuleDeviceCategory.airHumidifier,
        name: 'Test Air Humidifier',
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
          HumidifierChannelView(
            id: humidifierChannelId,
            type: 'humidifier',
            category: DevicesModuleChannelCategory.humidifier,
            device: deviceId,
            properties: [
              OnChannelPropertyView(
                id: onPropId,
                type: 'on',
                channel: humidifierChannelId,
                category: DevicesModulePropertyCategory.valueOn,
                value: BooleanValueType(true),
              ),
              HumidityChannelPropertyView(
                id: humidityPropId,
                type: 'humidity',
                channel: humidifierChannelId,
                category: DevicesModulePropertyCategory.humidity,
                value: NumberValueType(50),
                format: NumberListFormatType([30.0, 80.0]),
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
                value: BooleanValueType(true),
              ),
            ],
          ),
        ],
      );

      controller = AirHumidifierDeviceController(
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
      test('humidifier getter returns HumidifierChannelController', () {
        expect(controller.humidifier, isNotNull);
      });

      test('fan getter returns FanChannelController when present', () {
        expect(controller.fan, isNotNull);
      });

      test('fan getter returns null when fan channel not present', () {
        final deviceWithoutFan = AirHumidifierDeviceView(
          id: deviceId,
          type: 'air_humidifier',
          category: DevicesModuleDeviceCategory.airHumidifier,
          name: 'Test Air Humidifier',
          channels: [
            DeviceInformationChannelView(
              id: deviceInfoChannelId,
              type: 'device_information',
              category: DevicesModuleChannelCategory.deviceInformation,
              device: deviceId,
              properties: [],
            ),
            HumidifierChannelView(
              id: humidifierChannelId,
              type: 'humidifier',
              category: DevicesModuleChannelCategory.humidifier,
              device: deviceId,
              properties: [
                OnChannelPropertyView(
                  id: onPropId,
                  type: 'on',
                  channel: humidifierChannelId,
                  category: DevicesModulePropertyCategory.valueOn,
                  value: BooleanValueType(true),
                ),
                HumidityChannelPropertyView(
                  id: humidityPropId,
                  type: 'humidity',
                  channel: humidifierChannelId,
                  category: DevicesModulePropertyCategory.humidity,
                  value: NumberValueType(50),
                  format: NumberListFormatType([30.0, 80.0]),
                ),
              ],
            ),
          ],
        );

        final controllerWithoutFan = AirHumidifierDeviceController(
          device: deviceWithoutFan,
          controlState: mockControlState,
          devicesService: mockDevicesService,
        );

        expect(controllerWithoutFan.fan, isNull);
      });
    });

    group('device-level getters', () {
      test('isOn returns optimistic-aware value from humidifier controller',
          () {
        when(() => mockControlState.isLocked(
            deviceId, humidifierChannelId, onPropId)).thenReturn(false);

        expect(controller.isOn, isTrue);
      });

      test('isOn returns optimistic value when humidifier is locked', () {
        when(() => mockControlState.isLocked(
            deviceId, humidifierChannelId, onPropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, humidifierChannelId, onPropId)).thenReturn(false);

        expect(controller.isOn, isFalse);
      });

      test(
          'humidity returns optimistic-aware value from humidifier controller',
          () {
        when(() => mockControlState.isLocked(
            deviceId, humidifierChannelId, humidityPropId)).thenReturn(false);

        expect(controller.humidity, equals(50));
      });

      test('humidity returns optimistic value when humidifier is locked', () {
        when(() => mockControlState.isLocked(
            deviceId, humidifierChannelId, humidityPropId)).thenReturn(true);
        when(() => mockControlState.getDesiredValue(
            deviceId, humidifierChannelId, humidityPropId)).thenReturn(60);

        expect(controller.humidity, equals(60));
      });
    });

    group('passthrough getters', () {
      test('hasFan returns true when fan channel is present', () {
        expect(controller.hasFan, isTrue);
      });

      test('minHumidity returns channel value', () {
        expect(controller.minHumidity, equals(30));
      });

      test('maxHumidity returns channel value', () {
        expect(controller.maxHumidity, equals(80));
      });
    });

    group('device-level commands', () {
      test('setPower delegates to humidifier controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              humidifierChannelId,
              onPropId,
            )).thenReturn(null);

        controller.setPower(false);

        verify(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              onPropId,
              false,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(onPropId, false))
            .called(1);
      });

      test('togglePower delegates to humidifier controller', () {
        when(() => mockControlState.isLocked(
            deviceId, humidifierChannelId, onPropId)).thenReturn(false);
        when(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              onPropId,
              false,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(onPropId, false))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              humidifierChannelId,
              onPropId,
            )).thenReturn(null);

        controller.togglePower();

        verify(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              onPropId,
              false,
            )).called(1);
      });

      test('setHumidity delegates to humidifier controller', () async {
        when(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              humidityPropId,
              60,
            )).thenReturn(null);
        when(() => mockDevicesService.setPropertyValue(humidityPropId, 60))
            .thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              humidifierChannelId,
              humidityPropId,
            )).thenReturn(null);

        controller.setHumidity(60);

        verify(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              humidityPropId,
              60,
            )).called(1);

        await Future.delayed(Duration.zero);

        verify(() => mockDevicesService.setPropertyValue(humidityPropId, 60))
            .called(1);
      });
    });

    group('batch operations', () {
      test('setMultipleProperties succeeds and transitions all to settling',
          () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: humidifierChannelId,
            propertyId: onPropId,
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

        var successCalled = false;
        controller.setMultipleProperties(
          commands,
          onSuccess: () => successCalled = true,
        );

        // Verify pending was set immediately for both
        verify(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              onPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              fanOnPropId,
              true,
            )).called(1);

        await Future.delayed(Duration.zero);

        // Verify API was called
        verify(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).called(1);

        // Verify settling was called for both on success
        verify(() => mockControlState.setSettling(
              deviceId,
              humidifierChannelId,
              onPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              fanOnPropId,
            )).called(1);

        expect(successCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on API failure', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: humidifierChannelId,
            propertyId: onPropId,
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
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              any(),
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
              humidifierChannelId,
              onPropId,
            )).called(1);
        verify(() => mockControlState.clear(
              deviceId,
              fanChannelId,
              fanOnPropId,
            )).called(1);

        // Verify setSettling was NOT called
        verifyNever(() => mockControlState.setSettling(
              deviceId,
              any(),
              any(),
            ));

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on exception', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: humidifierChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => throw Exception('Network error'));
        when(() => mockControlState.clear(
              deviceId,
              humidifierChannelId,
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
              humidifierChannelId,
              onPropId,
            )).called(1);

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties calls controller onError callback on failure',
          () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = AirHumidifierDeviceController(
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
            channelId: humidifierChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              humidifierChannelId,
              onPropId,
            )).thenReturn(null);

        controllerWithError.setMultipleProperties(commands);

        await Future.delayed(Duration.zero);

        expect(errorPropertyId, equals(onPropId));
        expect(errorObject, isA<Exception>());
      });

      test('setMultipleProperties handles commands across multiple channels',
          () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: humidifierChannelId,
            propertyId: onPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: humidifierChannelId,
            propertyId: humidityPropId,
            value: 65,
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

        // Verify all pending states set
        verify(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              onPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              humidifierChannelId,
              humidityPropId,
              65,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              fanOnPropId,
              true,
            )).called(1);

        await Future.delayed(Duration.zero);

        // Verify all settling states set
        verify(() => mockControlState.setSettling(
              deviceId,
              humidifierChannelId,
              onPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              humidifierChannelId,
              humidityPropId,
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
