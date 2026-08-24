import 'dart:async';

import 'package:dio/dio.dart';
import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/models/control_state.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/generic_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lock.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
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
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/consumption.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

const homeyType = 'devices-homey';
const deviceId = '046f5102-1a8b-4e7d-a70e-20fe1fa836b1';
const deviceInformationChannelId = '375c48c4-d939-4267-b7e1-a8bfc4710fc2';
const lightChannelId = '7833d7c9-250c-46e6-9c27-438ac92f0a39';
const temperatureChannelId = '00f25c17-488b-44db-a413-59c31bd1803c';
const thermostatChannelId = '5f59626d-5b9a-4207-a195-c959a4467f50';
const lockChannelId = '6a9e7c5a-cbd4-4ded-9368-cbe7cd7d8b48';
const coverChannelId = '31204c4e-b38e-4f8b-a06b-816ac1310b18';
const powerChannelId = '26673bf2-63f4-44e1-8476-28ccca1c78d0';
const energyChannelId = '625b095a-5c13-47f0-89aa-837056eda993';
const propertyId = '80aa6c9c-918c-4751-af94-837a689f31dc';
const secondPropertyId = '349ebbb0-bce1-4248-982e-a320b91dfd5b';
const thirdPropertyId = '2a0c26f9-0c56-4fc8-83f9-e24469035a1d';
const fourthPropertyId = 'c3119230-cfd9-4bbe-896d-322bd68bfa63';
const manufacturerPropertyId = '4b649dac-fb01-40db-9d26-69f75b6079dc';
const modelPropertyId = '0c631313-c94d-4de2-9455-0d87ff6b5743';
const serialNumberPropertyId = '4bbd00b7-87ff-44f5-a69f-fddf72d2c356';
const redPropertyId = 'beeeef2b-4aa3-4d87-b3ca-dc182eef1027';
const greenPropertyId = 'f68afe04-7aeb-4b40-84ca-32d4b3c078f9';
const bluePropertyId = '8cd39807-f5dd-4519-b3eb-8ae62b8ad41d';

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
  String lastUpdated = '2026-08-24T10:00:00.000Z',
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
  'value': {'value': value, 'last_updated': lastUpdated},
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

class _MockDevicesService extends Mock implements DevicesService {}

class _MockPropertyTimeseriesService extends Mock
    implements PropertyTimeseriesService {}

class _MockDisplayRepository extends Mock implements DisplayRepository {}

class _MockConfigModuleService extends Mock implements ConfigModuleService {}

ChannelPropertyView _buildProperty({
  required String id,
  required String channel,
  required String category,
  required String dataType,
  required dynamic value,
  List<String> permissions = const ['ro'],
  List<dynamic>? format,
  String? unit,
  DateTime? lastUpdated,
}) => buildChannelPropertyView(
  buildChannelPropertyModel(
    homeyType,
    _propertyJson(
      id: id,
      channel: channel,
      category: category,
      dataType: dataType,
      value: value,
      permissions: permissions,
      capabilityId: 'fixture_$category',
      mappingName: 'fixture-$category',
      format: format,
      unit: unit,
      lastUpdated: lastUpdated?.toUtc().toIso8601String() ??
          '2026-08-24T10:00:00.000Z',
    ),
  ),
);

ChannelView _buildChannel(
  String id,
  String category,
  List<ChannelPropertyView> properties,
) => buildChannelView(
  buildChannelModel(
    homeyType,
    _channelJson(
      id,
      category,
      properties: properties.map((property) => property.id).toList(),
    ),
  ),
  properties,
);

ChannelView _buildDeviceInformationChannel() =>
    _buildChannel(deviceInformationChannelId, 'device_information', [
      _buildProperty(
        id: manufacturerPropertyId,
        channel: deviceInformationChannelId,
        category: 'manufacturer',
        dataType: 'string',
        value: 'Athom',
      ),
      _buildProperty(
        id: modelPropertyId,
        channel: deviceInformationChannelId,
        category: 'model',
        dataType: 'string',
        value: 'Homey fixture',
      ),
      _buildProperty(
        id: serialNumberPropertyId,
        channel: deviceInformationChannelId,
        category: 'serial_number',
        dataType: 'string',
        value: 'sanitized-fixture',
      ),
    ]);

List<ChannelView> _representativeChannels(
  String category, {
  bool? lightOn = true,
  DateTime? lightOnLastUpdated,
  List<int>? lightRgb,
  List<DateTime?>? lightRgbLastUpdated,
}) {
  final deviceInformation = _buildDeviceInformationChannel();

  switch (category) {
    case 'lighting':
      return [
        deviceInformation,
        _buildChannel(lightChannelId, 'light', [
          _buildProperty(
            id: propertyId,
            channel: lightChannelId,
            category: 'on',
            dataType: 'bool',
            value: lightOn,
            permissions: const ['rw'],
            lastUpdated: lightOnLastUpdated,
          ),
          if (lightRgb != null) ...[
            _buildProperty(
              id: redPropertyId,
              channel: lightChannelId,
              category: 'color_red',
              dataType: 'uchar',
              value: lightRgb[0],
              permissions: const ['rw'],
              format: const [0, 255],
              lastUpdated: lightRgbLastUpdated?[0],
            ),
            _buildProperty(
              id: greenPropertyId,
              channel: lightChannelId,
              category: 'color_green',
              dataType: 'uchar',
              value: lightRgb[1],
              permissions: const ['rw'],
              format: const [0, 255],
              lastUpdated: lightRgbLastUpdated?[1],
            ),
            _buildProperty(
              id: bluePropertyId,
              channel: lightChannelId,
              category: 'color_blue',
              dataType: 'uchar',
              value: lightRgb[2],
              permissions: const ['rw'],
              format: const [0, 255],
              lastUpdated: lightRgbLastUpdated?[2],
            ),
          ],
        ]),
        _buildChannel(powerChannelId, 'electrical_power', [
          _buildProperty(
            id: thirdPropertyId,
            channel: powerChannelId,
            category: 'power',
            dataType: 'float',
            value: 42.5,
            unit: 'W',
          ),
        ]),
        _buildChannel(energyChannelId, 'electrical_energy', [
          _buildProperty(
            id: fourthPropertyId,
            channel: energyChannelId,
            category: 'consumption',
            dataType: 'float',
            value: 12.75,
            unit: 'kWh',
          ),
        ]),
      ];
    case 'sensor':
      return [
        deviceInformation,
        _buildChannel(temperatureChannelId, 'temperature', [
          _buildProperty(
            id: propertyId,
            channel: temperatureChannelId,
            category: 'temperature',
            dataType: 'float',
            value: 21.5,
            unit: '°C',
          ),
        ]),
      ];
    case 'thermostat':
      return [
        deviceInformation,
        _buildChannel(temperatureChannelId, 'temperature', [
          _buildProperty(
            id: propertyId,
            channel: temperatureChannelId,
            category: 'temperature',
            dataType: 'float',
            value: 21.5,
            unit: '°C',
          ),
        ]),
        _buildChannel(thermostatChannelId, 'thermostat', const []),
      ];
    case 'window_covering':
      return [
        deviceInformation,
        _buildChannel(coverChannelId, 'window_covering', [
          _buildProperty(
            id: propertyId,
            channel: coverChannelId,
            category: 'status',
            dataType: 'enum',
            value: 'opened',
            format: const ['opened', 'closed', 'opening', 'closing', 'stopped'],
          ),
          _buildProperty(
            id: secondPropertyId,
            channel: coverChannelId,
            category: 'command',
            dataType: 'enum',
            value: 'stop',
            permissions: const ['wo'],
            format: const ['open', 'close', 'stop'],
          ),
          _buildProperty(
            id: thirdPropertyId,
            channel: coverChannelId,
            category: 'position',
            dataType: 'uchar',
            value: 75,
            permissions: const ['rw'],
            format: const [0, 100],
          ),
          _buildProperty(
            id: fourthPropertyId,
            channel: coverChannelId,
            category: 'type',
            dataType: 'enum',
            value: 'roller',
            format: const ['roller'],
          ),
        ]),
      ];
    case 'lock':
      return [
        deviceInformation,
        _buildChannel(lockChannelId, 'lock', [
          _buildProperty(
            id: propertyId,
            channel: lockChannelId,
            category: 'on',
            dataType: 'bool',
            value: true,
            permissions: const ['rw'],
          ),
          _buildProperty(
            id: secondPropertyId,
            channel: lockChannelId,
            category: 'status',
            dataType: 'enum',
            value: 'locked',
            format: const ['locked', 'unlocked'],
          ),
        ]),
      ];
  }

  throw ArgumentError.value(category, 'category');
}

DeviceView _buildRepresentativeDevice(
  String category, {
  bool? lightOn = true,
  DateTime? lightOnLastUpdated,
  List<int>? lightRgb,
  List<DateTime?>? lightRgbLastUpdated,
}) {
  final channels = _representativeChannels(
    category,
    lightOn: lightOn,
    lightOnLastUpdated: lightOnLastUpdated,
    lightRgb: lightRgb,
    lightRgbLastUpdated: lightRgbLastUpdated,
  );
  final model = buildDeviceModel(
    homeyType,
    _deviceJson(
      category,
      channels: channels.map((channel) => channel.id).toList(),
    ),
  );

  return buildDeviceView(model, channels);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  registerFallbackValue(TimeRange.oneDay);

  setUpAll(() async {
    await locator.reset();

    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 1280, screenHeight: 800, pixelRatio: 1),
      dispose: (service) => service.dispose(),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 1),
    );
    locator.registerSingleton<DevicesService>(_MockDevicesService());
    locator.registerSingleton<DisplayRepository>(_MockDisplayRepository());
    locator.registerSingleton<ConfigModuleService>(_MockConfigModuleService());
    locator.registerSingleton<EventBus>(EventBus());
    locator.registerSingleton<DeviceControlStateService>(
      DeviceControlStateService(),
      dispose: (service) => service.dispose(),
    );

    final timeseriesService = _MockPropertyTimeseriesService();
    when(
      () => timeseriesService.getTimeseries(
        channelId: any(named: 'channelId'),
        propertyId: any(named: 'propertyId'),
        timeRange: any(named: 'timeRange'),
      ),
    ).thenAnswer((_) async => PropertyTimeseries(points: []));
    locator.registerSingleton<PropertyTimeseriesService>(timeseriesService);
  });

  tearDownAll(locator.reset);

  group('Homey generic device pipeline', () {
    final deviceCases =
        <({String category, Matcher viewMatcher, Type widgetType})>[
          (
            category: 'lighting',
            viewMatcher: isA<LightingDeviceView>(),
            widgetType: LightingDeviceDetail,
          ),
          (
            category: 'sensor',
            viewMatcher: isA<SensorDeviceView>(),
            widgetType: SensorDeviceDetail,
          ),
          (
            category: 'thermostat',
            viewMatcher: isA<ThermostatDeviceView>(),
            widgetType: ThermostatDeviceDetail,
          ),
          (
            category: 'window_covering',
            viewMatcher: isA<WindowCoveringDeviceView>(),
            widgetType: WindowCoveringDeviceDetail,
          ),
          (
            category: 'lock',
            viewMatcher: isA<LockDeviceView>(),
            widgetType: LockDeviceDetail,
          ),
        ];

    for (final testCase in deviceCases) {
      testWidgets(
        'renders ${testCase.category} through the normal model and detail widget mappers',
        (tester) async {
          tester.view.physicalSize = const Size(1280, 800);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);

          expect(deviceModelMappers, isNot(contains(homeyType)));

          final view = _buildRepresentativeDevice(testCase.category);

          expect(view, testCase.viewMatcher);
          expect(view.type, homeyType);

          await tester.pumpWidget(
            MaterialApp(
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              home: buildDeviceWidget(view),
            ),
          );
          await tester.pump();

          expect(find.byType(testCase.widgetType), findsOneWidget);
          expect(tester.takeException(), isNull);
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
    testWidgets(
      'drives optimistic control to authoritative Homey state without credentials',
      (tester) async {
        tester.view.physicalSize = const Size(1280, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

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

        final controlState = locator<DeviceControlStateService>();
        controlState.clearForDevice(deviceId);
        addTearDown(() => controlState.clearForDevice(deviceId));
        final devicesService = locator<DevicesService>() as _MockDevicesService;
        reset(devicesService);
        final commandResult = Completer<bool>();
        when(
          () => devicesService.setPropertyValue(propertyId, true),
        ).thenAnswer((_) => commandResult.future);

        var renderedDevice =
            _buildRepresentativeDevice('lighting', lightOn: false)
                as LightingDeviceView;
        late StateSetter updateHost;
        await tester.pumpWidget(
          MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: StatefulBuilder(
              builder: (context, setState) {
                updateHost = setState;
                return LightingDeviceDetail(device: renderedDevice);
              },
            ),
          ),
        );

        final controller = LightingDeviceController(
          device: renderedDevice,
          controlState: controlState,
          devicesService: devicesService,
        );

        controller.setPower(true);

        final pending = controlState.getState(
          deviceId,
          lightChannelId,
          propertyId,
        );
        expect(pending?.isPending, isTrue);
        expect(pending?.desiredValue, isTrue);
        expect(controller.isOn, isTrue);
        final authoritativeEventAt = pending!.createdAt.add(
          const Duration(milliseconds: 1),
        );

        final sent = await tester.runAsync(
          () => propertiesRepository.setValue(propertyId, true),
        );

        expect(sent, isTrue);
        expect(
          controlState
              .getState(deviceId, lightChannelId, propertyId)
              ?.isPending,
          isTrue,
          reason: 'the Homey event arrives before the command acknowledgment',
        );

        updateHost(() {
          renderedDevice =
              _buildRepresentativeDevice('lighting', lightOn: false)
                  as LightingDeviceView;
        });
        await tester.pump();

        expect(
          controlState
              .getState(deviceId, lightChannelId, propertyId)
              ?.isPending,
          isTrue,
          reason: 'an equivalent rebuilt snapshot is not confirmation',
        );
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
            value: true,
            permissions: const ['rw'],
            capabilityId: 'onoff',
            mappingName: 'light-power',
          ),
        ]);

        final synchronized = propertiesRepository.getItem(propertyId)!;
        expect(synchronized, isA<GenericChannelPropertyModel>());
        final authoritativeValue =
            (synchronized.value as BooleanValueType).value;
        expect(authoritativeValue, isTrue);

        updateHost(() {
          renderedDevice = _buildRepresentativeDevice(
            'lighting',
            lightOn: true,
            lightOnLastUpdated: authoritativeEventAt,
          ) as LightingDeviceView;
        });
        await tester.pump();

        expect(
          controlState.getState(deviceId, lightChannelId, propertyId),
          isNull,
        );

        commandResult.complete(sent!);
        await tester.pump();

        expect(
          controlState.getState(deviceId, lightChannelId, propertyId),
          isNull,
          reason: 'the later acknowledgment must not reopen confirmed state',
        );
        expect(find.byType(LightingDeviceDetail), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('accepts a settled authoritative null as lighting divergence', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final controlState = locator<DeviceControlStateService>();
      controlState.clearForDevice(deviceId);
      addTearDown(() => controlState.clearForDevice(deviceId));

      var renderedDevice =
          _buildRepresentativeDevice('lighting', lightOn: false)
              as LightingDeviceView;
      late StateSetter updateHost;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: StatefulBuilder(
            builder: (context, setState) {
              updateHost = setState;
              return LightingDeviceDetail(device: renderedDevice);
            },
          ),
        ),
      );

      controlState.setPending(deviceId, lightChannelId, propertyId, true);
      controlState.setSettling(deviceId, lightChannelId, propertyId);
      final authoritativeEventAt = controlState
          .getState(deviceId, lightChannelId, propertyId)!
          .createdAt
          .add(const Duration(milliseconds: 1));

      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightOn: null,
          lightOnLastUpdated: authoritativeEventAt,
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState.getState(deviceId, lightChannelId, propertyId),
        isNull,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('retains pre-ack lighting divergence for settling', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final controlState = locator<DeviceControlStateService>();
      controlState.clearForDevice(deviceId);
      addTearDown(() => controlState.clearForDevice(deviceId));

      var renderedDevice =
          _buildRepresentativeDevice('lighting', lightOn: false)
              as LightingDeviceView;
      late StateSetter updateHost;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: StatefulBuilder(
            builder: (context, setState) {
              updateHost = setState;
              return LightingDeviceDetail(device: renderedDevice);
            },
          ),
        ),
      );

      controlState.setPending(deviceId, lightChannelId, propertyId, true);
      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightOn: null,
          lightOnLastUpdated: DateTime.utc(2026, 8, 24, 10, 1),
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState
            .getState(deviceId, lightChannelId, propertyId)
            ?.isPending,
        isTrue,
        reason: 'divergence must wait for this generation acknowledgment',
      );

      controlState.setSettling(deviceId, lightChannelId, propertyId);
      await tester.pump();

      expect(
        controlState.getState(deviceId, lightChannelId, propertyId),
        isNull,
        reason: 'the retained divergence is authoritative after acknowledgment',
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('waits for every authoritative grouped color component', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final controlState = locator<DeviceControlStateService>();
      controlState.clearForDevice(deviceId);
      addTearDown(() => controlState.clearForDevice(deviceId));

      var renderedDevice =
          _buildRepresentativeDevice('lighting', lightRgb: const [0, 0, 0])
              as LightingDeviceView;
      late StateSetter updateHost;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: StatefulBuilder(
            builder: (context, setState) {
              updateHost = setState;
              return LightingDeviceDetail(device: renderedDevice);
            },
          ),
        ),
      );

      controlState.setGroupPending(
        deviceId,
        LightChannelController.colorGroupId,
        const [
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: redPropertyId,
            desiredValue: 10,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: greenPropertyId,
            desiredValue: 20,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: bluePropertyId,
            desiredValue: 30,
          ),
        ],
      );
      controlState.setGroupSettling(
        deviceId,
        LightChannelController.colorGroupId,
      );
      final colorState = controlState.getGroupState(
        deviceId,
        LightChannelController.colorGroupId,
      )!;
      final firstEventAt = colorState.createdAt.add(
        const Duration(milliseconds: 1),
      );
      final secondEventAt = colorState.createdAt.add(
        const Duration(milliseconds: 2),
      );

      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightRgb: const [10, 0, 0],
          lightRgbLastUpdated: [firstEventAt, null, null],
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState
            .getGroupState(deviceId, LightChannelController.colorGroupId)
            ?.isSettling,
        isTrue,
        reason: 'one Homey RGB component does not confirm the whole group',
      );

      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightRgb: const [10, 20, 30],
          lightRgbLastUpdated: [firstEventAt, secondEventAt, secondEventAt],
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState.getGroupState(
          deviceId,
          LightChannelController.colorGroupId,
        ),
        isNull,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('retains pre-ack grouped color divergence for settling', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final controlState = locator<DeviceControlStateService>();
      controlState.clearForDevice(deviceId);
      addTearDown(() => controlState.clearForDevice(deviceId));

      var renderedDevice =
          _buildRepresentativeDevice('lighting', lightRgb: const [0, 0, 0])
              as LightingDeviceView;
      late StateSetter updateHost;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: StatefulBuilder(
            builder: (context, setState) {
              updateHost = setState;
              return LightingDeviceDetail(device: renderedDevice);
            },
          ),
        ),
      );

      controlState.setGroupPending(
        deviceId,
        LightChannelController.colorGroupId,
        const [
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: redPropertyId,
            desiredValue: 10,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: greenPropertyId,
            desiredValue: 20,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: bluePropertyId,
            desiredValue: 30,
          ),
        ],
      );
      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightRgb: const [5, 15, 25],
          lightRgbLastUpdated: List.filled(
            3,
            DateTime.utc(2026, 8, 24, 10, 1),
          ),
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState
            .getGroupState(deviceId, LightChannelController.colorGroupId)
            ?.isPending,
        isTrue,
      );

      controlState.setGroupSettling(
        deviceId,
        LightChannelController.colorGroupId,
      );
      await tester.pump();

      expect(
        controlState.getGroupState(
          deviceId,
          LightChannelController.colorGroupId,
        ),
        isNull,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('does not correlate post-ack color from an older command', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final controlState = locator<DeviceControlStateService>();
      controlState.clearForDevice(deviceId);
      addTearDown(() => controlState.clearForDevice(deviceId));

      var renderedDevice =
          _buildRepresentativeDevice('lighting', lightRgb: const [0, 0, 0])
              as LightingDeviceView;
      late StateSetter updateHost;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: StatefulBuilder(
            builder: (context, setState) {
              updateHost = setState;
              return LightingDeviceDetail(device: renderedDevice);
            },
          ),
        ),
      );

      controlState.setGroupPending(
        deviceId,
        LightChannelController.colorGroupId,
        const [
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: redPropertyId,
            desiredValue: 40,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: greenPropertyId,
            desiredValue: 50,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: bluePropertyId,
            desiredValue: 60,
          ),
        ],
      );
      controlState.setGroupSettling(
        deviceId,
        LightChannelController.colorGroupId,
      );

      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightRgb: const [10, 20, 30],
          lightRgbLastUpdated: List.filled(
            3,
            DateTime.utc(2026, 8, 24, 10, 1),
          ),
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState
            .getGroupState(deviceId, LightChannelController.colorGroupId)
            ?.isSettling,
        isTrue,
        reason: 'post-ack divergence is not correlated to the active command',
      );

      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightRgb: const [40, 50, 60],
          lightRgbLastUpdated: List.filled(
            3,
            DateTime.utc(2026, 8, 24, 10, 2),
          ),
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState.getGroupState(
          deviceId,
          LightChannelController.colorGroupId,
        ),
        isNull,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('ignores late color events from the previous command', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final controlState = locator<DeviceControlStateService>();
      controlState.clearForDevice(deviceId);
      addTearDown(() => controlState.clearForDevice(deviceId));

      var renderedDevice =
          _buildRepresentativeDevice('lighting', lightRgb: const [0, 0, 0])
              as LightingDeviceView;
      late StateSetter updateHost;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: StatefulBuilder(
            builder: (context, setState) {
              updateHost = setState;
              return LightingDeviceDetail(device: renderedDevice);
            },
          ),
        ),
      );

      controlState.setGroupPending(
        deviceId,
        LightChannelController.colorGroupId,
        const [
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: redPropertyId,
            desiredValue: 10,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: greenPropertyId,
            desiredValue: 20,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: bluePropertyId,
            desiredValue: 30,
          ),
        ],
      );
      controlState.setGroupPending(
        deviceId,
        LightChannelController.colorGroupId,
        const [
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: redPropertyId,
            desiredValue: 40,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: greenPropertyId,
            desiredValue: 50,
          ),
          PropertyConfig(
            channelId: lightChannelId,
            propertyId: bluePropertyId,
            desiredValue: 60,
          ),
        ],
      );
      final activeState = controlState.getGroupState(
        deviceId,
        LightChannelController.colorGroupId,
      )!;
      final previousCommandEventAt = activeState.createdAt.add(
        const Duration(days: 365),
      );

      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightRgb: const [10, 20, 30],
          lightRgbLastUpdated: List.filled(3, previousCommandEventAt),
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState
            .getGroupState(deviceId, LightChannelController.colorGroupId)
            ?.isPending,
        isTrue,
        reason: 'provider clock skew must not make stale values confirm the active generation',
      );

      final activeCommandEventAt = activeState.createdAt.subtract(
        const Duration(days: 365),
      );
      updateHost(() {
        renderedDevice = _buildRepresentativeDevice(
          'lighting',
          lightRgb: const [40, 50, 60],
          lightRgbLastUpdated: List.filled(3, activeCommandEventAt),
        ) as LightingDeviceView;
      });
      await tester.pump();

      expect(
        controlState.getGroupState(
          deviceId,
          LightChannelController.colorGroupId,
        ),
        isNull,
      );
      expect(tester.takeException(), isNull);
    });

    test('ignores completion from an older color command generation', () async {
      final controlState = locator<DeviceControlStateService>();
      controlState.clearForDevice(deviceId);
      addTearDown(() => controlState.clearForDevice(deviceId));

      final devicesService = locator<DevicesService>() as _MockDevicesService;
      reset(devicesService);
      final completions = List.generate(6, (_) => Completer<bool>());
      var commandCall = 0;
      when(
        () => devicesService.setPropertyValue(any(), any()),
      ).thenAnswer((_) => completions[commandCall++].future);
      final controller = LightingDeviceController(
        device: _buildRepresentativeDevice(
          'lighting',
          lightRgb: const [0, 0, 0],
        ) as LightingDeviceView,
        controlState: controlState,
        devicesService: devicesService,
      ).light;

      controller.setColorRGB(10, 20, 30);
      final firstGeneration = controlState.getGroupState(
        deviceId,
        LightChannelController.colorGroupId,
      )!;
      controller.setColorRGB(40, 50, 60);
      final secondGeneration = controlState.getGroupState(
        deviceId,
        LightChannelController.colorGroupId,
      )!;
      expect(identical(secondGeneration, firstGeneration), isFalse);

      for (final completion in completions.take(3)) {
        completion.complete(false);
      }
      await Future<void>.delayed(Duration.zero);

      final afterFirstCompletion = controlState.getGroupState(
        deviceId,
        LightChannelController.colorGroupId,
      );
      expect(identical(afterFirstCompletion, secondGeneration), isTrue);
      expect(afterFirstCompletion?.isPending, isTrue);

      for (final completion in completions.skip(3)) {
        completion.complete(true);
      }
      await Future<void>.delayed(Duration.zero);

      final afterSecondCompletion = controlState.getGroupState(
        deviceId,
        LightChannelController.colorGroupId,
      );
      expect(
        identical(
          afterSecondCompletion?.generation,
          secondGeneration.generation,
        ),
        isTrue,
      );
      expect(afterSecondCompletion?.isSettling, isTrue);
    });
  });
}
