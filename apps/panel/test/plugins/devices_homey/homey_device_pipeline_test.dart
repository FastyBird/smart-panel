import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/generic_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/consumption.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:flutter_test/flutter_test.dart';

const homeyType = 'devices-homey';
const deviceId = '046f5102-1a8b-4e7d-a70e-20fe1fa836b1';
const lightChannelId = '7833d7c9-250c-46e6-9c27-438ac92f0a39';
const temperatureChannelId = '00f25c17-488b-44db-a413-59c31bd1803c';
const thermostatChannelId = '5f59626d-5b9a-4207-a195-c959a4467f50';
const lockChannelId = '6a9e7c5a-cbd4-4ded-9368-cbe7cd7d8b48';
const coverChannelId = '31204c4e-b38e-4f8b-a06b-816ac1310b18';
const powerChannelId = '26673bf2-63f4-44e1-8476-28ccca1c78d0';
const energyChannelId = '625b095a-5c13-47f0-89aa-837056eda993';
const propertyId = '80aa6c9c-918c-4751-af94-837a689f31dc';
const secondPropertyId = '349ebbb0-bce1-4248-982e-a320b91dfd5b';

Map<String, dynamic> _deviceJson(
  String category, {
  List<String> channels = const [],
}) => {
  'id': deviceId,
  'type': homeyType,
  'category': category,
  'identifier': 'homey-device-fixture',
  'name': 'Homey fixture',
  'description': null,
  'enabled': true,
  'controls': <dynamic>[],
  'channels': channels,
  'zone_ids': <String>[],
  'status': {'online': true, 'last_changed': '2026-08-24T10:00:00.000Z'},
  'created_at': '2026-08-24T10:00:00.000Z',
  'updated_at': null,
};

Map<String, dynamic> _channelJson(
  String id,
  String category, {
  List<String> properties = const [],
}) => {
  'id': id,
  'type': homeyType,
  'category': category,
  'device': deviceId,
  'name': category,
  'description': null,
  'parent': null,
  'controls': <dynamic>[],
  'properties': properties,
  'created_at': '2026-08-24T10:00:00.000Z',
  'updated_at': null,
};

Map<String, dynamic> _propertyJson({
  required String id,
  required String channel,
  required String category,
  required String dataType,
  required dynamic value,
  List<String> permissions = const ['ro'],
  String capabilityId = 'measure_fixture',
  String mappingName = 'fixture-mapping',
  String? unit,
  List<dynamic>? format,
}) => {
  'id': id,
  'type': homeyType,
  'channel': channel,
  'category': category,
  'name': category,
  'permissions': permissions,
  'data_type': dataType,
  'unit': unit,
  'format': format,
  'invalid': null,
  'step': null,
  'default_value': null,
  'value': {'value': value, 'last_updated': '2026-08-24T10:00:00.000Z'},
  'homey_capability_id': capabilityId,
  'homey_mapping_name': mappingName,
  'created_at': '2026-08-24T10:00:00.000Z',
  'updated_at': null,
};

class _FakeSocketService extends SocketService {
  String? lastEvent;
  dynamic lastData;
  String? lastHandler;

  @override
  bool get isConnected => true;

  @override
  Future<void> sendCommand(
    String event,
    dynamic data,
    String handler, {
    Function(SocketCommandResponseModel?)? onAck,
  }) async {
    lastEvent = event;
    lastData = data;
    lastHandler = handler;
    onAck?.call(SocketCommandResponseModel(status: true, message: 'accepted'));
  }
}

void main() {
  group('Homey generic device pipeline', () {
    final deviceCases =
        <({String category, Matcher viewMatcher, Matcher widgetMatcher})>[
          (
            category: 'lighting',
            viewMatcher: isA<LightingDeviceView>(),
            widgetMatcher: isA<LightingDeviceDetail>(),
          ),
          (
            category: 'sensor',
            viewMatcher: isA<SensorDeviceView>(),
            widgetMatcher: isA<SensorDeviceDetail>(),
          ),
          (
            category: 'thermostat',
            viewMatcher: isA<ThermostatDeviceView>(),
            widgetMatcher: isA<ThermostatDeviceDetail>(),
          ),
          (
            category: 'window_covering',
            viewMatcher: isA<WindowCoveringDeviceView>(),
            widgetMatcher: isA<WindowCoveringDeviceDetail>(),
          ),
          (
            category: 'lock',
            viewMatcher: isA<LockDeviceView>(),
            widgetMatcher: isA<LockDeviceDetail>(),
          ),
        ];

    for (final testCase in deviceCases) {
      test(
        'loads ${testCase.category} through the normal model and detail widget mappers',
        () {
          expect(deviceModelMappers, isNot(contains(homeyType)));

          final model = buildDeviceModel(
            homeyType,
            _deviceJson(testCase.category),
          );
          final view = buildDeviceView(model, const []);

          expect(model.type, homeyType);
          expect(view, testCase.viewMatcher);
          expect(view.type, homeyType);
          expect(buildDeviceWidget(view), testCase.widgetMatcher);
        },
      );
    }

    test(
      'maps representative Homey channels and properties to existing views',
      () {
        final onModel = buildChannelPropertyModel(
          homeyType,
          _propertyJson(
            id: propertyId,
            channel: lightChannelId,
            category: 'on',
            dataType: 'bool',
            value: true,
            permissions: const ['rw'],
            capabilityId: 'onoff',
            mappingName: 'light-power',
          ),
        );
        final onView = buildChannelPropertyView(onModel);
        final lightView = buildChannelView(
          buildChannelModel(
            homeyType,
            _channelJson(
              lightChannelId,
              'light',
              properties: const [propertyId],
            ),
          ),
          [onView],
        );

        final temperatureView = buildChannelPropertyView(
          buildChannelPropertyModel(
            homeyType,
            _propertyJson(
              id: secondPropertyId,
              channel: temperatureChannelId,
              category: 'temperature',
              dataType: 'float',
              value: 21.5,
              capabilityId: 'measure_temperature',
              mappingName: 'sensor-temperature',
              unit: '°C',
            ),
          ),
        );

        final powerView = buildChannelPropertyView(
          buildChannelPropertyModel(
            homeyType,
            _propertyJson(
              id: propertyId,
              channel: powerChannelId,
              category: 'power',
              dataType: 'float',
              value: 42.5,
              capabilityId: 'measure_power',
              mappingName: 'instantaneous-power',
              unit: 'W',
            ),
          ),
        );
        final energyView = buildChannelPropertyView(
          buildChannelPropertyModel(
            homeyType,
            _propertyJson(
              id: secondPropertyId,
              channel: energyChannelId,
              category: 'consumption',
              dataType: 'float',
              value: 12.75,
              capabilityId: 'meter_power',
              mappingName: 'accumulated-energy',
              unit: 'kWh',
            ),
          ),
        );

        final powerChannel = buildChannelView(
          buildChannelModel(
            homeyType,
            _channelJson(
              powerChannelId,
              'electrical_power',
              properties: const [propertyId],
            ),
          ),
          [powerView],
        );
        final energyChannel = buildChannelView(
          buildChannelModel(
            homeyType,
            _channelJson(
              energyChannelId,
              'electrical_energy',
              properties: const [secondPropertyId],
            ),
          ),
          [energyView],
        );
        final lightingDevice = buildDeviceView(
          buildDeviceModel(
            homeyType,
            _deviceJson(
              'lighting',
              channels: const [lightChannelId, powerChannelId, energyChannelId],
            ),
          ),
          [lightView, powerChannel, energyChannel],
        );

        expect(onModel, isA<GenericChannelPropertyModel>());
        expect(
          (onModel as GenericChannelPropertyModel)
              .configuration['homey_capability_id'],
          'onoff',
        );
        expect(onView, isA<OnChannelPropertyView>());
        expect(lightView, isA<LightChannelView>());
        expect(temperatureView, isA<TemperatureChannelPropertyView>());
        expect(
          buildChannelView(
            buildChannelModel(
              homeyType,
              _channelJson(temperatureChannelId, 'temperature'),
            ),
            [temperatureView],
          ),
          isA<TemperatureChannelView>(),
        );
        expect(
          buildChannelView(
            buildChannelModel(
              homeyType,
              _channelJson(thermostatChannelId, 'thermostat'),
            ),
            const [],
          ),
          isA<ThermostatChannelView>(),
        );
        expect(
          buildChannelView(
            buildChannelModel(homeyType, _channelJson(lockChannelId, 'lock')),
            const [],
          ),
          isA<LockChannelView>(),
        );
        expect(
          buildChannelView(
            buildChannelModel(
              homeyType,
              _channelJson(coverChannelId, 'window_covering'),
            ),
            const [],
          ),
          isA<WindowCoveringChannelView>(),
        );
        expect(powerView, isA<PowerChannelPropertyView>());
        expect(powerChannel, isA<ElectricalPowerChannelView>());
        expect((powerChannel as ElectricalPowerChannelView).power, 42.5);
        expect(energyView, isA<ConsumptionChannelPropertyView>());
        expect(energyChannel, isA<ElectricalEnergyChannelView>());
        expect(
          (energyChannel as ElectricalEnergyChannelView).consumption,
          12.75,
        );
        expect(lightingDevice, isA<LightingDeviceView>());
        expect(
          (lightingDevice as LightingDeviceView).electricalPowerChannel?.power,
          42.5,
        );
        expect(lightingDevice.electricalEnergyChannel?.consumption, 12.75);
        expect(buildDeviceWidget(lightingDevice), isA<LightingDeviceDetail>());
      },
    );
  });

  group('Homey state and control pipeline', () {
    test(
      'applies authoritative updates and dispatches commands without Homey credentials',
      () async {
        final apiClient = DevicesModuleClient(
          Dio(),
          baseUrl: 'http://localhost',
        );
        final socket = _FakeSocketService();
        final propertiesRepository = ChannelPropertiesRepository(
          apiClient: apiClient,
          commandDispatch: CommandDispatchService(socketService: socket),
        );
        final channelsRepository = ChannelsRepository(
          apiClient: apiClient,
          channelPropertiesRepository: propertiesRepository,
        );
        final devicesRepository = DevicesRepository(
          apiClient: apiClient,
          channelsRepository: channelsRepository,
        );

        propertiesRepository.setChannelsRepository(channelsRepository);
        propertiesRepository.setDevicesRepository(devicesRepository);

        devicesRepository.insert([
          _deviceJson('lighting', channels: const [lightChannelId]),
        ]);
        channelsRepository.insert([
          _channelJson(lightChannelId, 'light', properties: const [propertyId]),
        ]);
        propertiesRepository.insert([
          _propertyJson(
            id: propertyId,
            channel: lightChannelId,
            category: 'on',
            dataType: 'bool',
            value: false,
            permissions: const ['rw'],
            capabilityId: 'onoff',
            mappingName: 'light-power',
          ),
        ]);

        expect(
          (propertiesRepository.getItem(propertyId)!.value as BooleanValueType)
              .value,
          isFalse,
        );

        final sent = await propertiesRepository.setValue(propertyId, true);

        expect(sent, isTrue);
        expect(socket.lastEvent, DevicesModuleConstants.setPropertyEvent);
        expect(socket.lastHandler, DevicesModuleEventHandlerName.setProperty);
        expect(socket.lastData, {
          'request_id': isA<String>(),
          'properties': [
            {
              'device': deviceId,
              'channel': lightChannelId,
              'property': propertyId,
              'value': true,
            },
          ],
        });
        expect(
          (socket.lastData as Map<String, dynamic>).keys,
          isNot(contains('api_key')),
        );

        propertiesRepository.insert([
          _propertyJson(
            id: propertyId,
            channel: lightChannelId,
            category: 'on',
            dataType: 'bool',
            value: false,
            permissions: const ['rw'],
            capabilityId: 'onoff',
            mappingName: 'light-power',
          ),
        ]);

        final synchronized = propertiesRepository.getItem(propertyId)!;
        expect(synchronized, isA<GenericChannelPropertyModel>());
        expect((synchronized.value as BooleanValueType).value, isFalse);
      },
    );
  });
}
