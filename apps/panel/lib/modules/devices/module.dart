import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/device_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/plugins/devices-home-assistant/plugin.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-ng/plugin.dart';
import 'package:fastybird_smart_panel/plugins/devices-shelly-v1/plugin.dart';
import 'package:fastybird_smart_panel/plugins/devices-third-party/plugin.dart';
import 'package:fastybird_smart_panel/plugins/devices-wled/plugin.dart';
import 'package:fastybird_smart_panel/plugins/devices-zigbee2mqtt/plugin.dart';
import 'package:flutter/foundation.dart';

class DevicesModuleService {
  final SocketService _socketService;

  late DevicesRepository _devicesRepository;
  late DeviceControlsRepository _deviceControlsRepository;
  late ChannelsRepository _channelsRepository;
  late ChannelControlsRepository _channelControlsRepository;
  late ChannelPropertiesRepository _channelPropertiesRepository;
  late DeviceValidationRepository _validationRepository;

  late DevicesService _devicesService;

  bool _isLoading = true;

  DevicesModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    // Register all device plugins
    DevicesThirdPartyPlugin.register();
    DevicesHomeAssistantPlugin.register();
    DevicesShellyNgPlugin.register();
    DevicesShellyV1Plugin.register();
    DevicesWledPlugin.register();
    DevicesZigbee2mqttPlugin.register();

    // Initialize repositories in dependency order:
    // 1. ChannelPropertiesRepository (no repo dependencies)
    // 2. ChannelsRepository (depends on ChannelPropertiesRepository for embedded data)
    // 3. DevicesRepository (depends on ChannelsRepository for embedded data)
    // 4. Set ChannelsRepository in ChannelPropertiesRepository (for setValue command)

    _channelPropertiesRepository = ChannelPropertiesRepository(
      apiClient: apiClient.devicesModule,
      socketService: _socketService,
    );
    _channelControlsRepository = ChannelControlsRepository(
      apiClient: apiClient.devicesModule,
    );
    _channelsRepository = ChannelsRepository(
      apiClient: apiClient.devicesModule,
      channelPropertiesRepository: _channelPropertiesRepository,
    );

    // Set the channels repository for command handling
    _channelPropertiesRepository.setChannelsRepository(_channelsRepository);

    _deviceControlsRepository = DeviceControlsRepository(
      apiClient: apiClient.devicesModule,
    );
    _devicesRepository = DevicesRepository(
      apiClient: apiClient.devicesModule,
      channelsRepository: _channelsRepository,
    );
    _validationRepository = DeviceValidationRepository(
      apiClient: apiClient.devicesModule,
    );

    _devicesService = DevicesService(
      devicesRepository: _devicesRepository,
      devicesControlsRepository: _deviceControlsRepository,
      channelsRepository: _channelsRepository,
      channelPropertiesRepository: _channelPropertiesRepository,
      channelControlsRepository: _channelControlsRepository,
      validationRepository: _validationRepository,
    );

    // Note: IntentOverlayService is now provided by the IntentsModule
    // to avoid duplicate registrations and ensure single source of truth

    locator.registerSingleton(_devicesRepository);
    locator.registerSingleton(_deviceControlsRepository);

    locator.registerSingleton(_channelsRepository);
    locator.registerSingleton(_channelControlsRepository);
    locator.registerSingleton(_channelPropertiesRepository);
    locator.registerSingleton(_validationRepository);

    locator.registerSingleton(_devicesService);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _devicesService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      DevicesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[DEVICES MODULE][MODULE] Module was successfully initialized',
      );
    }
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      DevicesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  /// ////////////////
  /// SOCKETS HANDLERS
  /// ////////////////

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    /// Device CREATE/UPDATE
    if (event == DevicesModuleConstants.deviceCreatedEvent ||
        event == DevicesModuleConstants.deviceUpdatedEvent) {
      _devicesRepository.insert([payload]);

      /// Device DELETE
    } else if (event == DevicesModuleConstants.deviceDeletedEvent &&
        payload.containsKey('id')) {
      _devicesRepository.delete(payload['id']);

      /// Device control CREATE
    } else if (event == DevicesModuleConstants.deviceControlCreatedEvent) {
      _deviceControlsRepository.insert([payload]);

      /// Device control DELETE
    } else if (event == DevicesModuleConstants.deviceControlDeletedEvent &&
        payload.containsKey('id')) {
      _deviceControlsRepository.delete(payload['id']);

      /// Channel CREATE/UPDATE
    } else if (event == DevicesModuleConstants.channelCreatedEvent ||
        event == DevicesModuleConstants.channelUpdatedEvent) {
      _channelsRepository.insert([payload]);

      /// Channel DELETE
    } else if (event == DevicesModuleConstants.channelDeletedEvent &&
        payload.containsKey('id')) {
      _channelsRepository.delete(payload['id']);

      /// Channel control CREATE
    } else if (event == DevicesModuleConstants.channelControlCreatedEvent) {
      _channelControlsRepository.insert([payload]);

      /// Channel control DELETE
    } else if (event == DevicesModuleConstants.channelControlDeletedEvent &&
        payload.containsKey('id')) {
      _channelControlsRepository.delete(payload['id']);

      /// Channel property CREATE/UPDATE
    } else if (event == DevicesModuleConstants.channelPropertyCreatedEvent ||
        event == DevicesModuleConstants.channelPropertyUpdatedEvent ||
        event == DevicesModuleConstants.channelPropertyValueSetEvent) {
      _channelPropertiesRepository.insert([payload]);

      /// Channel property DELETE
    } else if (event == DevicesModuleConstants.channelPropertyDeletedEvent &&
        payload.containsKey('id')) {
      _channelPropertiesRepository.delete(payload['id']);
    }
  }
}
