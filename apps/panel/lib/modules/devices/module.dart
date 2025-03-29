import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/api/models/devices_device.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/device_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:flutter/foundation.dart';

class DevicesModuleService {
  final DevicesModuleClient _apiClient;

  final SocketService _socketService;

  late DevicesRepository _devicesRepository;
  late DeviceControlsRepository _deviceControlsRepository;
  late ChannelsRepository _channelsRepository;
  late ChannelControlsRepository _channelControlsRepository;
  late ChannelPropertiesRepository _channelPropertiesRepository;

  bool _isLoading = true;

  DevicesModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  })  : _apiClient = apiClient.devicesModule,
        _socketService = socketService {
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

    locator.registerSingleton(_devicesRepository);
    locator.registerSingleton(_deviceControlsRepository);

    locator.registerSingleton(_channelsRepository);
    locator.registerSingleton(_channelControlsRepository);
    locator.registerSingleton(_channelPropertiesRepository);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _initializeDevices();

    _isLoading = false;

    _socketService.registerEventHandler(
      DevicesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      DevicesModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  Future<void> _initializeDevices() async {
    var apiDevices = await _fetchDevices();

    List<Map<String, dynamic>> devices = [];

    for (var device in apiDevices) {
      devices.add(jsonDecode(jsonEncode(device)));
    }

    _devicesRepository.insert(devices);

    for (var apiDevice in apiDevices) {
      List<Map<String, dynamic>> deviceControls = [];

      for (var control in apiDevice.controls) {
        deviceControls.add(jsonDecode(jsonEncode(control)));
      }

      _deviceControlsRepository.insert(deviceControls);

      List<Map<String, dynamic>> channels = [];

      for (var channel in apiDevice.channels) {
        channels.add(jsonDecode(jsonEncode(channel)));
      }

      _channelsRepository.insert(channels);

      for (var apiChannel in apiDevice.channels) {
        List<Map<String, dynamic>> channelControls = [];

        for (var control in apiChannel.controls) {
          channelControls.add(jsonDecode(jsonEncode(control)));
        }

        _channelControlsRepository.insert(channelControls);

        List<Map<String, dynamic>> properties = [];

        for (var property in apiChannel.properties) {
          properties.add(jsonDecode(jsonEncode(property)));
        }

        _channelPropertiesRepository.insert(properties);
      }
    }
  }

  /// ////////////
  /// API HANDLERS
  /// ////////////

  Future<List<DevicesDevice>> _fetchDevices() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getDevicesModuleDevices();

        return response.data.data;
      },
      'fetch devices',
    );
  }

  Future<T> _handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to $operation: ${e.response?.statusCode}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
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
