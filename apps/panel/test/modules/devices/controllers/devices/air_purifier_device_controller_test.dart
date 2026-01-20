import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
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
  group('AirPurifierDeviceController', () {
    late MockDeviceControlStateService mockControlState;
    late MockDevicesService mockDevicesService;
    late AirPurifierDeviceView device;
    late AirPurifierDeviceController controller;

    const deviceId = 'device-123';
    const fanChannelId = 'fan-channel-456';
    const deviceInfoChannelId = 'device-info-789';
    const onPropId = 'on-prop-101';

    setUpAll(() {
      registerFallbackValue(FakePropertyCommandItem());
      registerFallbackValue(<PropertyCommandItem>[]);
    });

    setUp(() {
      mockControlState = MockDeviceControlStateService();
      mockDevicesService = MockDevicesService();

      device = AirPurifierDeviceView(
        id: deviceId,
        type: 'air_purifier',
        category: DevicesModuleDeviceCategory.airPurifier,
        name: 'Test Air Purifier',
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
                value: BooleanValueType(true),
              ),
            ],
          ),
        ],
      );

      controller = AirPurifierDeviceController(
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

    group('batch operations', () {
      test('setMultipleProperties succeeds and transitions all to settling',
          () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: fanChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              onPropId,
            )).thenReturn(null);

        var successCalled = false;
        controller.setMultipleProperties(
          commands,
          onSuccess: () => successCalled = true,
        );

        // Verify pending was set immediately
        verify(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              true,
            )).called(1);

        // Wait for async operations
        await Future.delayed(Duration.zero);

        // Verify API was called
        verify(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).called(1);

        // Verify settling was called on success
        verify(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              onPropId,
            )).called(1);

        expect(successCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on API failure', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: fanChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              fanChannelId,
              onPropId,
            )).thenReturn(null);

        var errorCalled = false;
        controller.setMultipleProperties(
          commands,
          onError: () => errorCalled = true,
        );

        await Future.delayed(Duration.zero);

        // Verify clear was called on failure
        verify(() => mockControlState.clear(
              deviceId,
              fanChannelId,
              onPropId,
            )).called(1);

        // Verify setSettling was NOT called
        verifyNever(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              onPropId,
            ));

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties rolls back all on exception', () async {
        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: fanChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => throw Exception('Network error'));
        when(() => mockControlState.clear(
              deviceId,
              fanChannelId,
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
              fanChannelId,
              onPropId,
            )).called(1);

        expect(errorCalled, isTrue);
      });

      test('setMultipleProperties calls controller onError callback on failure',
          () async {
        String? errorPropertyId;
        Object? errorObject;

        final controllerWithError = AirPurifierDeviceController(
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
            channelId: fanChannelId,
            propertyId: onPropId,
            value: true,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              true,
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => false);
        when(() => mockControlState.clear(
              deviceId,
              fanChannelId,
              onPropId,
            )).thenReturn(null);

        controllerWithError.setMultipleProperties(commands);

        await Future.delayed(Duration.zero);

        expect(errorPropertyId, equals(onPropId));
        expect(errorObject, isA<Exception>());
      });

      test('setMultipleProperties handles multiple commands', () async {
        const secondPropId = 'speed-prop-202';

        final commands = [
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: fanChannelId,
            propertyId: onPropId,
            value: true,
          ),
          PropertyCommandItem(
            deviceId: deviceId,
            channelId: fanChannelId,
            propertyId: secondPropId,
            value: 50,
          ),
        ];

        when(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              any(),
              any(),
            )).thenReturn(null);
        when(() => mockDevicesService.setMultiplePropertyValues(
              properties: any(named: 'properties'),
            )).thenAnswer((_) async => true);
        when(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              any(),
            )).thenReturn(null);

        controller.setMultipleProperties(commands);

        // Verify pending was set for both
        verify(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              onPropId,
              true,
            )).called(1);
        verify(() => mockControlState.setPending(
              deviceId,
              fanChannelId,
              secondPropId,
              50,
            )).called(1);

        await Future.delayed(Duration.zero);

        // Verify settling was called for both
        verify(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              onPropId,
            )).called(1);
        verify(() => mockControlState.setSettling(
              deviceId,
              fanChannelId,
              secondPropId,
            )).called(1);
      });
    });
  });
}
