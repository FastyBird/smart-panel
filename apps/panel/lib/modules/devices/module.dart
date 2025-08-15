import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/device_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:flutter/foundation.dart';

class DevicesModuleService {
  final SocketService _socketService;

  late DevicesRepository _devicesRepository;
  late DeviceControlsRepository _deviceControlsRepository;
  late ChannelsRepository _channelsRepository;
  late ChannelControlsRepository _channelControlsRepository;
  late ChannelPropertiesRepository _channelPropertiesRepository;

  late DevicesService _devicesService;

  bool _isLoading = true;

  DevicesModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
    _devicesRepository = DevicesRepository(
      apiClient: apiClient.devicesModule,
    );
    _deviceControlsRepository = DeviceControlsRepository(
      apiClient: apiClient.devicesModule,
    );
    _channelsRepository = ChannelsRepository(
      apiClient: apiClient.devicesModule,
    );
    _channelControlsRepository = ChannelControlsRepository(
      apiClient: apiClient.devicesModule,
    );
    _channelPropertiesRepository = ChannelPropertiesRepository(
      apiClient: apiClient.devicesModule,
      socketService: _socketService,
      channelsRepository: _channelsRepository,
    );

    _devicesService = DevicesService(
      devicesRepository: _devicesRepository,
      devicesControlsRepository: _deviceControlsRepository,
      channelsRepository: _channelsRepository,
      channelPropertiesRepository: _channelPropertiesRepository,
      channelControlsRepository: _channelControlsRepository,
    );

    locator.registerSingleton(_devicesRepository);
    locator.registerSingleton(_deviceControlsRepository);

    locator.registerSingleton(_channelsRepository);
    locator.registerSingleton(_channelControlsRepository);
    locator.registerSingleton(_channelPropertiesRepository);

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
        event == DevicesModuleConstants.channelPropertyUpdatedEvent) {
      _channelPropertiesRepository.insert([payload]);

      /// Channel property DELETE
    } else if (event == DevicesModuleConstants.channelPropertyDeletedEvent &&
        payload.containsKey('id')) {
      _channelPropertiesRepository.delete(payload['id']);
    }
  }
}
